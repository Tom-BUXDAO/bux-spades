import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import sharp from 'sharp';
import { writeFile } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
    }

    // Convert File to Buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Generate unique filename
    const filename = `${uuidv4()}${path.extname(file.name)}`;
    const publicDir = path.join(process.cwd(), 'public', 'avatars');
    const outputPath = path.join(publicDir, filename);

    // Optimize and save image
    await sharp(buffer)
      .resize(150, 150, {
        fit: 'cover',
        position: 'center'
      })
      .toBuffer()
      .then(async (optimizedBuffer) => {
        await writeFile(outputPath, optimizedBuffer);
      });

    // Update user's avatar in database
    const imageUrl = `/avatars/${filename}`;
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: { image: imageUrl },
    });

    return NextResponse.json({ image: updatedUser.image });
  } catch (error) {
    console.error('Error updating avatar:', error);
    return NextResponse.json(
      { error: 'Failed to update avatar' },
      { status: 500 }
    );
  }
} 