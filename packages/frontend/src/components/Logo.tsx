import React from 'react';

/**
 * The Bomizzel brand mark, in one place.
 *
 * It used to be a stock Heroicons ticket outline pasted inline wherever a logo
 * was wanted, so there was no single thing to change.
 *
 * The artwork is cut from the supplied Bomizzel.com.png lockup: the B monogram
 * on its own for anywhere small, since the stacked lockup's "Software
 * Solutions" line and tagline are unreadable below about 200px. The full
 * lockup lives at /logo-full.png for places with room for it.
 *
 * The wordmark beside the mark is set in Inter rather than cut from the
 * artwork. The drawn wordmark is condensed and carries a gradient, which goes
 * muddy at header size and cannot invert for dark mode; type stays crisp at any
 * size. Swap it for an image here if you would rather have the drawn one.
 */
const LOGO_SRC = '/logo-mark.png';

type LogoProps = {
  /** Height of the mark in pixels; the wordmark scales with it. */
  size?: number;
  /** Set false for the mark on its own, e.g. a collapsed sidebar. */
  showWordmark?: boolean;
  className?: string;
};

const Mark: React.FC<{ size: number }> = ({ size }) => (
  <img src={LOGO_SRC} alt="" width={size} height={size} className="block" />
);

const Logo: React.FC<LogoProps> = ({ size = 32, showWordmark = true, className = '' }) => (
  <span className={`inline-flex items-center gap-2.5 ${className}`}>
    <Mark size={size} />
    {showWordmark && (
      <span
        className="font-semibold tracking-tight text-gray-900 dark:text-white"
        style={{ fontSize: size * 0.7 }}
      >
        Bomizzel
      </span>
    )}
  </span>
);

export default Logo;
