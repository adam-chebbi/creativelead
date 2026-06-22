import { getServerSession } from 'next-auth';
import { authOptions } from '../api/auth/[...nextauth]/options';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { Laptop } from 'lucide-react';

export default async function ConnectWorkerPage() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    // If not logged in, force login and return here
    redirect('/login?callbackUrl=/connect-worker');
  }

  // Generate a secure pairing token
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  // Create a new worker session in the database
  await prisma.workerSession.create({
    data: {
      userId: session.user.id,
      tokenHash,
      status: 'online',
    },
  });

  const workerUrl = `autoreach-worker://auth?token=${token}`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a1414] text-white p-6">
      <div className="max-w-md w-full p-8 rounded-2xl border" style={{ background: '#0d1a1a', borderColor: '#1e3232' }}>
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-[#1e3232] flex items-center justify-center mx-auto mb-6 text-[#4ecdc4]">
            <Laptop className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold mb-3">Connecting Desktop App</h1>
          <p className="text-[#6a9090] text-sm mb-8">
            Your browser should prompt you to open the AutoReach Worker application.
          </p>
          
          <div className="animate-pulse flex justify-center mb-8">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-[#4ecdc4]"></div>
              <div className="w-3 h-3 rounded-full bg-[#4ecdc4] delay-75"></div>
              <div className="w-3 h-3 rounded-full bg-[#4ecdc4] delay-150"></div>
            </div>
          </div>

          <p className="text-[#6a9090] text-xs">
            Didn't get a prompt?
          </p>
          <a 
            href={workerUrl}
            className="inline-block mt-3 px-6 py-2 rounded-lg text-sm font-medium text-white transition-colors"
            style={{ background: '#e8806a' }}
          >
            Click here to open app
          </a>
        </div>
      </div>

      <script
        dangerouslySetInnerHTML={{
          __html: `
            setTimeout(function() {
              window.location.href = "${workerUrl}";
            }, 1000);
          `
        }}
      />
    </div>
  );
}
