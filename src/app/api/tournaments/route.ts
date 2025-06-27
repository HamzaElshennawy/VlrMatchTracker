import { NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/database';
import { ApiResponse, Tournament } from '@/types';

export async function GET() {
  try {
    const db = new DatabaseService();
    const tournaments = db.getTournaments();

    return NextResponse.json({
      success: true,
      data: tournaments
    } as ApiResponse<Tournament[]>);

  } catch (error) {
    console.error('Error fetching tournaments:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch tournaments'
    } as ApiResponse<null>, { status: 500 });
  }
}