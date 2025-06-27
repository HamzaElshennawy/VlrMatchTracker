import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/database';
import { ApiResponse, MatchListResponse } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const db = new DatabaseService();
    const searchParams = request.nextUrl.searchParams;
    
    const status = searchParams.get('status') || 'all';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    const result = db.getMatches(status, limit, offset);
    
    const response: MatchListResponse = {
      matches: result.matches,
      total: result.total,
      page,
      per_page: limit,
      has_next: offset + limit < result.total
    };

    return NextResponse.json({
      success: true,
      data: response
    } as ApiResponse<MatchListResponse>);

  } catch (error) {
    console.error('Error fetching matches:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch matches'
    } as ApiResponse<null>, { status: 500 });
  }
}