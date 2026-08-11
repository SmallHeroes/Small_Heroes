import { notFound } from 'next/navigation';

import { SiteHeader } from '@/app/components/SiteHeader';
import ReaderV2 from '@/app/book/[id]/read-v2/reader-v2';
import shellStyles from '@/app/book/[id]/read-v2/read-v2-shell.module.css';
import { isDevEnvironment } from '@/lib/dev-only-guard';
import { loadDevViewerAuditionBook } from '@/lib/dev-viewer-book-load';
import type { ReaderBookPayload } from '@/lib/reader-book-source';
import { trackedQaReaderFixtureForDir } from '@/lib/tracked-qa-reader-fixtures';

import '../../landing/main.css';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function asSingle(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function QaReaderPage({ searchParams }: PageProps) {
  if (!isDevEnvironment()) notFound();

  const query = await searchParams;
  const dir = asSingle(query.dir)?.trim();
  if (!dir || !trackedQaReaderFixtureForDir(dir)) notFound();

  const fixture = await loadDevViewerAuditionBook(dir, 'outputs');
  const payload: ReaderBookPayload = {
    id: fixture.id,
    status: 'QA_FIXTURE_READY',
    childName: fixture.childName,
    storyDirection: fixture.storyDirection,
    storyLength: fixture.storyLength,
    powerCard: null,
    book: {
      title: fixture.book.title,
      pages: fixture.book.pages,
      audioUrl: null,
    },
  };
  const viewerHref = `/dev/viewer?dir=${encodeURIComponent(dir)}&root=outputs`;

  return (
    <div className={shellStyles.shell} data-reader-authority="tracked-qa-reader-fixture/v1">
      <div className={shellStyles.headerSlot}>
        <SiteHeader variant="compact" />
      </div>
      <ReaderV2
        source={{
          kind: 'qa_fixture',
          payload,
          exitHref: viewerHref,
          exitLabel: 'חזרה לספריית QA',
        }}
      />
    </div>
  );
}
