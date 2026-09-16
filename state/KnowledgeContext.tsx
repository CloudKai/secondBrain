import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

import type { FolderId, KnowledgeItem } from '@/types/knowledge';

type KnowledgeContextValue = {
  items: readonly KnowledgeItem[];
  addItem: (item: KnowledgeItem) => void;
  getItemsForFolder: (folderId: FolderId) => readonly KnowledgeItem[];
};

const KnowledgeContext = createContext<KnowledgeContextValue | null>(null);

export function KnowledgeProvider({ children }: PropsWithChildren) {
  const [items, setItems] = useState<KnowledgeItem[]>([]);

  const addItem = useCallback((item: KnowledgeItem) => {
    setItems((current) => [item, ...current]);
  }, []);

  const getItemsForFolder = useCallback(
    (folderId: FolderId) =>
      items.filter((item) => item.folder_id === folderId),
    [items],
  );

  const value = useMemo(
    () => ({ items, addItem, getItemsForFolder }),
    [addItem, getItemsForFolder, items],
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
