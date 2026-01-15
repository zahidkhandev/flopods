export interface User {
  userId: string;
  email: string;
  name: string | null;
  image: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  deviceId: string;
}

export interface RegisterData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

// LoginData stays the same
export interface LoginData {
  email: string;
  password: string;
}
export interface LoginResponse {
  statusCode: number;
  message: string;
  data: {
    userId: string;
    email: string;
    accessToken: string;
    refreshToken: string;
    deviceId: string;
    deviceName: string;
  };
  errors: any[];
  timestamp: string;
}

export interface UserMeResponse {
  statusCode: number;
  message: string;
  data: {
    userId: string;
    email: string;
    name: string | null;
    image: string | null;
    createdAt: string;
    updatedAt: string;
  };
  errors: any[];
  timestamp: string;
}
