import type { InstrumentId } from "../api/schemas";

const logos: Record<InstrumentId, string> = {
  RNVDAUSDT: "/stock-logos/nvidia.svg",
  RAAPLUSDT: "/stock-logos/apple.svg",
  RMSFTUSDT: "/stock-logos/microsoft.svg",
  RGOOGLUSDT: "/stock-logos/alphabet.svg",
  RAMZNUSDT: "/stock-logos/amazon.svg",
  RTSLAUSDT: "/stock-logos/tesla.svg",
};

export function RevisoMark({ className = "" }: { className?: string }) {
  return (
    <img
      className={`reviso-mark ${className}`.trim()}
      src="/reviso-mark.svg"
      alt=""
      aria-hidden="true"
    />
  );
}

export function CompanyLogo({
  instrumentId,
  className = "",
}: {
  instrumentId: InstrumentId;
  className?: string;
}) {
  return (
    <span className={`company-logo ${className}`.trim()} aria-hidden="true">
      <img src={logos[instrumentId]} alt="" />
    </span>
  );
}
