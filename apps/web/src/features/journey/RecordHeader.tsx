import { Link } from "react-router-dom";
import { CompanyLogo } from "../../components/Brand";
import { ideaTitle } from "../../lib/format";
import type { Instrument, ThesisRecord } from "../../api/schemas";

export default function RecordHeader({
  instrument,
  record,
}: {
  instrument: Instrument;
  record: ThesisRecord;
}) {
  return (
    <section className="record-header">
      <div className="record-header-identity">
        <CompanyLogo instrumentId={instrument.id} className="record-mark" />
        <div>
          <p className="record-kicker">
            {instrument.display_name} · {instrument.base_coin} / USDT
          </p>
          <h1>{ideaTitle(record.thesis.rationale)}</h1>
        </div>
      </div>
      <div className="record-header-meta">
        <span className="version">v{record.version}</span>
        <Link className="button-link" to={`/app/thesis/${record.id}/timeline`}>
          Decision history
        </Link>
      </div>
    </section>
  );
}
