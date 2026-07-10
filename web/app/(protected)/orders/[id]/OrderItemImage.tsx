'use client';

import { useState } from 'react';

const PLACEHOLDER = '/placeholder-product.svg';

/** Order-line thumbnail (snapshot URL) with a placeholder fallback. */
export default function OrderItemImage({ src }: { src: string }) {
  const [current, setCurrent] = useState(src || PLACEHOLDER);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={current} alt="" onError={() => setCurrent(PLACEHOLDER)} />
  );
}
