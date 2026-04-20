"use client";
import dynamic from "next/dynamic";

// R3F's Canvas does DOM work that doesn't match an empty SSR render,
// causing React hydration errors. Load it client-side only.
export const BlockchainBackgroundClient = dynamic(
  () => import("./BlockchainBackground").then((m) => m.BlockchainBackground),
  { ssr: false }
);
