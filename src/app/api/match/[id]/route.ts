import { NextRequest, NextResponse } from "next/server";
import { VLRScraper } from "@/lib/scraper";
import { ApiResponse, MatchDetailScrapeData } from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const scraper = new VLRScraper();
    const resolvedParams = await params;
    const vlrMatchId = resolvedParams.id;

    if (!vlrMatchId) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid VLR match ID",
        } as ApiResponse<null>,
        { status: 400 }
      );
    }

    // Always get detailed match data
    const detailedData = await scraper.scrapeMatchDetails(vlrMatchId);
    if (!detailedData) {
      return NextResponse.json(
        {
          success: false,
          error: "Match not found or details unavailable on VLR.gg",
        } as ApiResponse<null>,
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ...detailedData,
        scraped_at: new Date().toISOString(),
      },
    } as ApiResponse<MatchDetailScrapeData & { scraped_at: string }>);
  } catch (error) {
    console.error("Error scraping match details:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to scrape match details from VLR.gg",
      } as ApiResponse<null>,
      { status: 500 }
    );
  }
}
