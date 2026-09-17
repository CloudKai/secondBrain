import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

import type {
  FolderId,
  KnowledgeItem,
  LearningProgress,
} from '@/types/knowledge';

const emptyProgress: LearningProgress = {
  completed_lesson_steps: [],
  mastered_edge_ids: [],
};

type KnowledgeContextValue = {
  items: readonly KnowledgeItem[];
  addItem: (item: KnowledgeItem) => void;
  getItemsForFolder: (folderId: FolderId) => readonly KnowledgeItem[];
  getProgress: (itemId: string) => LearningProgress;
  toggleLessonStep: (itemId: string, step: number) => void;
  markEdgeMastery: (itemId: string, edgeId: string, mastered: boolean) => void;
};

const KnowledgeContext = createContext<KnowledgeContextValue | null>(null);

export function KnowledgeProvider({ children }: PropsWithChildren) {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [progressByItem, setProgressByItem] = useState<
    Record<string, LearningProgress>
  >({});

  const addItem = useCallback((item: KnowledgeItem) => {
    setItems((current) => {
      const withoutDuplicate = current.filter(
        (candidate) => candidate.id !== item.id,
      );
      return [item, ...withoutDuplicate];
    });
  }, []);

  const getItemsForFolder = useCallback(
    (folderId: FolderId) =>
      items.filter((item) => item.folder_id === folderId),
    [items],
  );

  const getProgress = useCallback(
    (itemId: string) => progressByItem[itemId] ?? emptyProgress,
    [progressByItem],
  );

  const toggleLessonStep = useCallback((itemId: string, step: number) => {
    setProgressByItem((current) => {
      const itemProgress = current[itemId] ?? emptyProgress;
      const completed = new Set(itemProgress.completed_lesson_steps);
      if (completed.has(step)) completed.delete(step);
      else completed.add(step);
      return {
        ...current,
        [itemId]: {
          ...itemProgress,
          completed_lesson_steps: [...completed].sort((a, b) => a - b),
        },
      };
    });
  }, []);

  const markEdgeMastery = useCallback(
    (itemId: string, edgeId: string, mastered: boolean) => {
      setProgressByItem((current) => {
        const itemProgress = current[itemId] ?? emptyProgress;
        const masteredEdges = new Set(itemProgress.mastered_edge_ids);
        if (mastered) masteredEdges.add(edgeId);
        else masteredEdges.delete(edgeId);
        return {
          ...current,
          [itemId]: {
            ...itemProgress,
            mastered_edge_ids: [...masteredEdges],
          },
        };
      });
    },
    [],
  );

  const value = useMemo(
    () => ({
      items,
      addItem,
      getItemsForFolder,
      getProgress,
      toggleLessonStep,
      markEdgeMastery,
    }),
    [
      addItem,
      getItemsForFolder,
      getProgress,
      items,
      markEdgeMastery,
      toggleLessonStep,
    ],
  );

  return (
    <KnowledgeContext.Provider value={value}>
      {children}
    </KnowledgeContext.Provider>
  );
}

export function useKnowledge(): KnowledgeContextValue {
  const value = useContext(KnowledgeContext);
  if (!value) {
    throw new Error('useKnowledge must be used inside KnowledgeProvider');
  }
  return value;
}
