'use strict';

class RestError extends Error {
  constructor({ method, path, status, body }) {
    const errorText = body && (body.error || body.exception || body.error_description);
    super(`${method} ${path} failed with HTTP ${status}${errorText ? `: ${errorText}` : ''}`);
    this.name = 'RestError';
    this.method = method;
    this.path = path;
    this.status = status;
    this.body = body;
  }
}

class NetworkRestError extends Error {
  constructor({ method, path, cause }) {
    super(`${method} ${path} failed before HTTP response: ${cause.message}`);
    this.name = 'NetworkRestError';
    this.method = method;
    this.path = path;
    this.cause = cause;
  }
}

function encodePath(value) {
  return encodeURIComponent(value);
}

function isMissingResourceError(error) {
  if (!(error instanceof RestError)) {
    return false;
  }
  const bodyText = JSON.stringify(error.body || {}).toLowerCase();
  return error.status === 404 || bodyText.includes('not_found') || bodyText.includes('not found');
}

function isDuplicateUserError(error) {
  if (!(error instanceof RestError)) {
    return false;
  }
  const bodyText = JSON.stringify(error.body || {}).toLowerCase();
  return error.status === 400 && (
    bodyText.includes('duplicate_unique_property_exists') ||
    bodyText.includes('duplicateuniquepropertyexistsexception')
  );
}

class EasemobRestClient {
  constructor({ restHost, restOrgName, restAppName, restAppToken, requestTimeoutMs = 30000, fetchImpl = fetch, logger }) {
    this.baseUrl = `${restHost}/${encodePath(restOrgName)}/${encodePath(restAppName)}`;
    this.restAppToken = restAppToken;
    this.requestTimeoutMs = requestTimeoutMs;
    this.fetchImpl = fetchImpl;
    this.logger = logger;
  }

  async request(method, requestPath, body) {
    const headers = {
      Accept: 'application/json',
      Authorization: `Bearer ${this.restAppToken}`,
    };
    const options = {
      method,
      headers,
      signal: AbortSignal.timeout(this.requestTimeoutMs),
    };

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }

    this.logger?.info?.(`REST ${method} ${requestPath}`);
    let response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${requestPath}`, options);
    } catch (cause) {
      const error = new NetworkRestError({ method, path: requestPath, cause });
      this.logger?.error?.('REST request failed before HTTP response', {
        method,
        path: requestPath,
        errorName: cause.name,
        errorMessage: cause.message,
      });
      throw error;
    }
    const responseBody = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new RestError({ method, path: requestPath, status: response.status, body: responseBody });
      this.logger?.error?.('REST request failed', {
        method,
        path: requestPath,
        status: response.status,
        error: responseBody.error,
        exception: responseBody.exception,
        error_description: responseBody.error_description,
      });
      throw error;
    }

    return responseBody;
  }

  registerUsers(users) {
    return this.request('POST', '/users', users);
  }

  getUser(username) {
    return this.request('GET', `/users/${encodePath(username)}`);
  }

  resetPassword(username, password) {
    return this.request('PUT', `/users/${encodePath(username)}/password`, { newpassword: password });
  }

  deleteUser(username) {
    return this.request('DELETE', `/users/${encodePath(username)}`);
  }

  addFriend(ownerUsername, friendUsername) {
    return this.request(
      'POST',
      `/users/${encodePath(ownerUsername)}/contacts/users/${encodePath(friendUsername)}`,
    );
  }

  deleteFriend(ownerUsername, friendUsername) {
    return this.request(
      'DELETE',
      `/users/${encodePath(ownerUsername)}/contacts/users/${encodePath(friendUsername)}`,
    );
  }

  createGroup({ name, description, owner, members }) {
    return this.request('POST', '/chatgroups', {
      groupname: name,
      description,
      public: true,
      maxusers: 300,
      owner,
      members,
    });
  }

  deleteGroup(groupId) {
    return this.request('DELETE', `/chatgroups/${encodePath(groupId)}`);
  }

  createChatRoom({ name, description, owner, members }) {
    return this.request('POST', '/chatrooms', {
      name,
      description,
      maxusers: 300,
      owner,
      members,
    });
  }

  deleteChatRoom(roomId) {
    return this.request('DELETE', `/chatrooms/${encodePath(roomId)}`);
  }
}

module.exports = {
  EasemobRestClient,
  NetworkRestError,
  RestError,
  isDuplicateUserError,
  isMissingResourceError,
};
