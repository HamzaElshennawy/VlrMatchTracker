import { NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/database';
import { ApiResponse, Team } from '@/types';

export async function GET() {
  try {
    const db = new DatabaseService();
    const teams = db.getTeams();

    return NextResponse.json({
      success: true,
      data: teams
    } as ApiResponse<Team[]>);

  } catch (error) {
    console.error('Error fetching teams:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch teams'
    } as ApiResponse<null>, { status: 500 });
  }
}