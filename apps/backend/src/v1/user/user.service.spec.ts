import { NotFoundException } from '@nestjs/common';
import { V1UserService } from './user.service';

describe('V1UserService', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
  } as any;

  let service: V1UserService;

  beforeEach(() => {
    prisma.user.findUnique.mockReset();
    service = new V1UserService(prisma);
  });

  it('returns user by id', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'usr_123',
      email: 'user@flopods.com',
      firstName: 'Zahid',
      lastName: 'Khan',
      image: null,
      createdAt: new Date('2025-01-15T10:00:00.000Z'),
      updatedAt: new Date('2025-01-20T10:00:00.000Z'),
    });

    const result = await service.findById('usr_123');

    expect(result.email).toBe('user@flopods.com');
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'usr_123' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        image: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });

  it('throws when user is missing', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.findById('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns verified status for oauth users', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'usr_123',
      email: 'user@flopods.com',
      accounts: [],
    });

    const result = await service.checkEmailVerificationStatus('usr_123');

    expect(result).toEqual({ isVerified: true, email: 'user@flopods.com' });
  });

  it('returns verified status when email account has no access token', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'usr_123',
      email: 'user@flopods.com',
      accounts: [{ provider: 'EMAIL', accessToken: null }],
    });

    const result = await service.checkEmailVerificationStatus('usr_123');

    expect(result).toEqual({ isVerified: true, email: 'user@flopods.com' });
  });

  it('returns unverified status when email account has access token', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'usr_123',
      email: 'user@flopods.com',
      accounts: [{ provider: 'EMAIL', accessToken: 'pending-token' }],
    });

    const result = await service.checkEmailVerificationStatus('usr_123');

    expect(result).toEqual({ isVerified: false, email: 'user@flopods.com' });
  });
});
