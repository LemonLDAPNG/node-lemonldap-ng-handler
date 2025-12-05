import type { Request } from "express";
import type { LLNG_Conf, LLNG_Session, LLNG_Logger } from "@lemonldap-ng/types";

/**
 * Credentials extracted from login form
 */
export interface Credentials {
  user: string;
  password: string;
}

/**
 * Authentication result
 */
export interface AuthResult {
  success: boolean;
  user?: string;
  error?: string;
  errorCode?: string;
}

/**
 * User data from UserDB
 */
export interface UserData {
  uid: string;
  attributes: Record<string, string | string[]>;
  groups?: string[];
}

/**
 * Authentication module interface
 */
export interface AuthModule {
  /** Module name */
  readonly name: string;

  /** Initialize module with configuration */
  init(_conf: LLNG_Conf, _logger: LLNG_Logger): Promise<void>;

  /** Extract credentials from request */
  extractCredentials(_req: Request): Credentials | null;

  /** Authenticate user with credentials */
  authenticate(_credentials: Credentials): Promise<AuthResult>;

  /** Optional: cleanup */
  close?(): Promise<void>;
}

/**
 * UserDB module interface
 */
export interface UserDBModule {
  /** Module name */
  readonly name: string;

  /** Initialize module with configuration */
  init(_conf: LLNG_Conf, _logger: LLNG_Logger): Promise<void>;

  /** Get user data by username */
  getUser(_username: string): Promise<UserData | null>;

  /** Set session info from user data */
  setSessionInfo(_session: LLNG_Session, _user: UserData): void;

  /** Optional: cleanup */
  close?(): Promise<void>;
}

/**
 * Extended Express Request with portal data
 */
export interface PortalRequest extends Request {
  /** Current session (if authenticated) */
  llngSession?: LLNG_Session;
  /** Session ID from cookie */
  llngSessionId?: string;
  /** Extracted credentials */
  llngCredentials?: Credentials;
  /** Authentication result */
  llngAuthResult?: AuthResult;
  /** User data from UserDB */
  llngUserData?: UserData;
  /** Portal URL */
  llngPortal?: string;
  /** URL to redirect after login */
  llngUrldc?: string;
}

/**
 * Portal initialization options
 */
export interface PortalOptions {
  /** Configuration storage options */
  configStorage?: {
    confFile?: string;
    type?: string;
    [key: string]: any;
  };
  /** Path to template views */
  viewsPath?: string;
  /** Static files path */
  staticPath?: string;
}

/**
 * Template context for rendering
 */
export interface TemplateContext {
  /** Portal URL */
  PORTAL?: string;
  /** Error message */
  AUTH_ERROR?: string;
  /** Error code */
  AUTH_ERROR_CODE?: string;
  /** User login (for pre-fill) */
  LOGIN?: string;
  /** URL to redirect after auth */
  URLDC?: string;
  /** Session data */
  session?: LLNG_Session;
  /** Custom data */
  [key: string]: any;
}
