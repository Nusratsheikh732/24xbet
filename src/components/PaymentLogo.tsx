interface PaymentLogoProps {
  methodId: string;
  size?: number;
}

const LOGO_URLS: Record<string, string> = {
  bkash: 'https://i.postimg.cc/jSwm5mcB/images-(11).jpg',
  nagad: 'https://i.postimg.cc/sXyNTXrk/images-(5).jpg',
  rocket: 'https://i.postimg.cc/vTZSdNDx/images-(12).jpg',
  binance: 'https://i.postimg.cc/PfSRMTF0/images-(13).jpg',
  upay: 'https://i.postimg.cc/KzsyKQVy/images-(3).png',
  usdt: 'https://i.postimg.cc/mr8vq8Th/images-(10).jpg',
  bybit: 'https://i.postimg.cc/cLMy7djw/images-(12).jpg',
  bitget: 'https://i.postimg.cc/Df1S59TG/images-(4).png',
};

export default function PaymentLogo({ methodId, size = 36 }: PaymentLogoProps) {
  const url = LOGO_URLS[methodId];

  if (url) {
    return (
      <div
        className="rounded-lg overflow-hidden bg-white/95 flex items-center justify-center shrink-0"
        style={{ width: size, height: size }}
      >
        <img
          src={url}
          alt={methodId}
          className="w-full h-full object-contain"
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div
      className="rounded-lg bg-gray-700 flex items-center justify-center shrink-0 text-white font-bold"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      ?
    </div>
  );
}
