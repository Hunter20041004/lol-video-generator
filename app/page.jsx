"use client";

import { useEffect, useState } from "react";
import { StudioShell } from "./components/studio/StudioShell";
import { createPortfolioDemoStateFromSearch } from "../utils/portfolioDemo";

export default function HomePage() {
  const [portfolioDemoState, setPortfolioDemoState] = useState(null);
  const portfolioReadOnly = process.env.NEXT_PUBLIC_PORTFOLIO_READ_ONLY === "true";

  useEffect(() => {
    setPortfolioDemoState(createPortfolioDemoStateFromSearch(window.location.search));
  }, []);

  return (
    <StudioShell
      portfolioReadOnly={portfolioReadOnly}
      portfolioDemoState={portfolioDemoState}
    />
  );
}
