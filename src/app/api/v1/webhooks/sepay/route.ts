import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  const body = await request.json();
  console.log('Webhook received:', body);
  // Example body:
  // {
  //   gateway: 'Vietcombank',
  //   transactionDate: '2026-01-27 08:45:29',
  //   accountNumber: '0706213188',
  //   subAccount: null,
  //   code: 'LTR000001',
  //   content: 'LTR000001',
  //   transferType: 'in',
  //   description: null,
  //   transferAmount: 10000,
  //   referenceCode: '510787.270126.084529',
  //   accumulated: 10000,
  //   id: 241439
  // }
  return new Response('Webhook received', { status: 200 });
}
