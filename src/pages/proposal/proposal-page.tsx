import { useEffect } from "react"

import { AboutUs } from "./sections/about-us"
import { Footer } from "./sections/footer"
import { Hero } from "./sections/hero"
import { Intro } from "./sections/intro"
import { Investment } from "./sections/investment"
import { IpLicense } from "./sections/ip-license"
import { Legal } from "./sections/legal"
import { NextSteps } from "./sections/next-steps"
import { QuickSummary } from "./sections/quick-summary"
import { Risks } from "./sections/risks"
import { Summary } from "./sections/summary"
import { Timeline } from "./sections/timeline"
import { WhatIncluded } from "./sections/what-included"
import { WhatNotIncluded } from "./sections/what-not-included"
import { WhyThisPrice } from "./sections/why-this-price"

export default function ProposalPage() {
  // Set page title for the browser tab
  useEffect(() => {
    const prev = document.title
    document.title = "AnyTour CRM — Komercійна пропозиція · Webspirio"
    return () => {
      document.title = prev
    }
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <Hero />
      <QuickSummary />
      <AboutUs />
      <Intro />
      <WhatIncluded />
      <WhatNotIncluded />
      <Timeline />
      <Investment />
      <WhyThisPrice />
      <NextSteps />
      <Risks />
      <Legal />
      <IpLicense />
      <Summary />
      <Footer />
    </div>
  )
}
