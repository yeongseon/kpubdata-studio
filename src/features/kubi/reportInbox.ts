/**
 * ADD_REPORT_BLOCK 승인 결과를 담아두는 로컬 큐 (#256).
 *
 * Reports 화면(`/reports`)의 실제 편집/발행 기능은 #258에서 구현된다 — 여기서는 그 전체
 * 기능을 대신 만들지 않고, "사용자가 승인한 Kubi 참고 노트를 어딘가에 안전하게 보관해 두고
 * Reports 진입점으로 연결"하는 최소 handoff만 제공한다. `draftStorage.ts`와 동일한
 * `{version, data, savedAt}` 봉투 규약을 따른다.
 */
export interface KubiReportNote {
  note: string;
  reason: string;
  context: { datasetId?: string; runId?: string; stage?: string };
  savedAt: string;
}

const INBOX_KEY = "kpubdata-studio:kubi-report-inbox";
const INBOX_VERSION = 1;
const INBOX_LIMIT = 20;

interface InboxEnvelope {
  version: number;
  notes: KubiReportNote[];
}

function readEnvelope(): InboxEnvelope {
  const empty: InboxEnvelope = { version: INBOX_VERSION, notes: [] };
  try {
    const raw = localStorage.getItem(INBOX_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as unknown;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      (parsed as InboxEnvelope).version !== INBOX_VERSION ||
      !Array.isArray((parsed as InboxEnvelope).notes)
    ) {
      return empty;
    }
    return parsed as InboxEnvelope;
  } catch {
    return empty;
  }
}

/** 승인된 Kubi 참고 노트를 큐에 추가한다. 실패 시 조용히 무시한다(승인 흐름을 막지 않는다). */
export function queueKubiReportNote(note: KubiReportNote): void {
  try {
    const envelope = readEnvelope();
    envelope.notes.push(note);
    if (envelope.notes.length > INBOX_LIMIT) {
      envelope.notes = envelope.notes.slice(envelope.notes.length - INBOX_LIMIT);
    }
    localStorage.setItem(INBOX_KEY, JSON.stringify(envelope));
  } catch {
    // localStorage 사용 불가 시 무시.
  }
}

/** 큐에 쌓인 노트를 오래된 순으로 반환한다. */
export function listKubiReportNotes(): KubiReportNote[] {
  return readEnvelope().notes;
}
