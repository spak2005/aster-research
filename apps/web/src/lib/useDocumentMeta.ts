/**
 * Page title and description per route.
 *
 * Hash routes never reach a server, so nothing else updates the document head
 * as the reader moves. Titles say what is on screen and avoid asserting results
 * that the page itself may still be withholding.
 */
import { useEffect } from 'react';

export const SITE_NAME = 'Aster Research';

function setDescription(description: string): void {
  let tag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (!tag) {
    tag = document.createElement('meta');
    tag.name = 'description';
    document.head.append(tag);
  }
  tag.content = description;
}

export function useDocumentMeta(title: string | null, description?: string): void {
  useEffect(() => {
    if (title === null) return;
    document.title = title === SITE_NAME ? title : `${title} · ${SITE_NAME}`;
    if (description) setDescription(description);
  }, [title, description]);
}
