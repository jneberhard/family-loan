"use client";

import Link from "next/link";

export function VideoNavLink() {
  function playExplainer() {
    const video = document.getElementById("explainer-video");
    if (video instanceof HTMLVideoElement) {
      void video.play().catch(() => undefined);
    }
  }

  return (
    <Link href="#explainer-video" className="button button-ghost" onClick={playExplainer}>
      Video
    </Link>
  );
}
