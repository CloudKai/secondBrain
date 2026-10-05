-- Public YouTube captions use direct origin; supplied transcript records are unchanged.
begin;
alter table public.sources drop constraint sources_document_identity_check;
alter table public.sources add constraint sources_document_identity_check check (
  (source_kind = 'article' and original_url is not null and canonical_url ~ '^https?://' and document is null and transcript is null and capture_origin <> 'upload')
  or (source_kind = 'pdf' and transcript is null and public.valid_pdf_document(document,captured_text) and
    ((capture_origin = 'upload' and original_url is null and canonical_url ~ '^urn:pdf:sha256:[a-f0-9]{64}$' and document->>'filename' is not null)
     or (capture_origin = 'direct' and original_url is not null and canonical_url ~ '^https?://')))
  or (source_kind = 'video' and original_url is not null and canonical_url ~ '^https://' and document is null
    and coverage in ('unknown','partial') and public.valid_video_transcript(transcript,captured_text)
    and ((capture_origin = 'pasted' and transcript->'filename' = 'null'::jsonb)
      or (capture_origin = 'direct' and transcript->'filename' = 'null'::jsonb
        and transcript->>'provider' = 'youtube' and transcript->>'format' = 'vtt')
      or (capture_origin = 'upload' and transcript->>'filename' is not null)))
);

commit;
