import {ReturnCallback} from '../RNWS';

export type ApiResponse = {
  ok: true;
  value: any;
};

export type ProtocolErrorType =
  | 'invalid_json'
  | 'invalid_command'
  | 'unknown_command';

export type ProtocolErrorResponse = {
  type: 'protocol_error';
  error: {
    type: ProtocolErrorType;
    message: string;
    details?: any;
  };
};

export function normalizeApiValue(value: any): any {
  return value === undefined ? null : value;
}

export function wrapApiCallback(callback: ReturnCallback): ReturnCallback {
  return value => callback({ok: true, value: normalizeApiValue(value)});
}

export function protocolError(
  type: ProtocolErrorType,
  message: string,
  details?: any,
): ProtocolErrorResponse {
  return {
    type: 'protocol_error',
    error: details === undefined ? {type, message} : {type, message, details},
  };
}
