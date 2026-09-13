import { Test } from '@nestjs/testing';
import { V1UserController } from './user.controller';
import { V1UserService } from './user.service';

describe('V1UserController', () => {
  let controller: V1UserController;
  let userService: jest.Mocked<V1UserService>;

  const mockUser = {
    id: 'usr_123',
    email: 'user@flopods.com',
    firstName: 'Zahid',
    lastName: 'Khan',
    image: null,
    createdAt: new Date('2025-01-15T10:00:00.000Z'),
    updatedAt: new Date('2025-01-20T10:00:00.000Z'),
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [V1UserController],
      providers: [
        {
          provide: V1UserService,
          useValue: {
            getCurrentUser: jest.fn(),
            checkEmailVerificationStatus: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = moduleRef.get(V1UserController);
    userService = moduleRef.get(V1UserService);
  });

  it('returns current user profile payload', async () => {
    userService.getCurrentUser.mockResolvedValue(mockUser as any);

    const response = await controller.getMe('usr_123');

    expect(userService.getCurrentUser).toHaveBeenCalledWith('usr_123');
    expect(response).toEqual({
      statusCode: 200,
      message: 'User fetched successfully',
      data: {
        userId: mockUser.id,
        email: mockUser.email,
        name: mockUser.firstName,
        image: mockUser.image,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      },
      errors: [],
      timestamp: expect.any(String),
    });
  });

  it('returns email verification status payload', async () => {
    userService.checkEmailVerificationStatus.mockResolvedValue({
      isVerified: true,
      email: 'user@flopods.com',
    });

    const response = await controller.getVerificationStatus('usr_123');

    expect(userService.checkEmailVerificationStatus).toHaveBeenCalledWith('usr_123');
    expect(response).toEqual({
      statusCode: 200,
      message: 'Verification status fetched successfully',
      data: {
        isVerified: true,
        email: 'user@flopods.com',
      },
      errors: [],
      timestamp: expect.any(String),
    });
  });
});
