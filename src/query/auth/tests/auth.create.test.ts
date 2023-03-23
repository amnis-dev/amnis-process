import { mockService } from '@amnis/mock';
import {
  accountsGet,
  agentUpdate,
  contactSlice,
  profileSlice,
  userSlice,
} from '@amnis/state';
import { apiSys } from '../../sys/index.js';
import { apiAuth } from '../index.js';
import {
  serviceConfig,
} from './config.js';
import {
  clientStore,
} from './store.js';

beforeAll(async () => {
  await mockService.setup(await serviceConfig());
  mockService.start();
  await clientStore.dispatch(
    apiSys.endpoints.system.initiate({
      url: 'http://localhost/api/sys/system',
      set: true,
    }),
  );
});

afterAll(() => {
  mockService.stop();
});

test('should NOT create a new account as a regular user', async () => {
  /**
   * Set the agent credentials to the user.
   */
  const { user } = await accountsGet();
  await agentUpdate({
    credentialId: user.credential.$id,
    privateKey: user.privateKey,
  });

  /**
   * Login
   */
  await clientStore.dispatch(apiAuth.endpoints.login.initiate({
    handle: user.handle,
    password: user.password,
  }));

  /**
   * Create the new account.
   */
  const response = await clientStore.dispatch(apiAuth.endpoints.create.initiate({
    handle: 'newbie',
    password: 'newpass123',
  }));

  if ('error' in response) {
    expect(response.error).toBeUndefined();
    return;
  }

  expect(response.data.result).toBeUndefined();
  expect(response.data.logs).toHaveLength(1);
  expect(response.data.logs[0].level).toBe('error');
  expect(response.data.logs[0].title).toBe('Unauthorized');
});

test('should create a new account as a privileged account', async () => {
  /**
   * Set the agent credentials to the administrators.
   */
  const { admin } = await accountsGet();
  await agentUpdate({
    credentialId: admin.credential.$id,
    privateKey: admin.privateKey,
  });

  /**
   * Login
   */
  await clientStore.dispatch(apiAuth.endpoints.login.initiate({
    handle: admin.handle,
    password: admin.password,
  }));

  /**
   * Create the new account.
   */
  const response = await clientStore.dispatch(apiAuth.endpoints.create.initiate({
    handle: 'newbie',
    password: 'newpass123',
  }));

  if ('error' in response) {
    expect(response.error).toBeUndefined();
    return;
  }

  const { data: { logs, result } } = response;

  if (!result) {
    expect(result).toBeDefined();
    return;
  }

  expect(logs).toHaveLength(1);
  expect(logs[0].level).toBe('success');
  expect(logs[0].title).toBe('Account Created');

  expect(Object.keys(result).length).toBe(4);

  const user = userSlice.selectors.byId(clientStore.getState(), result[userSlice.key][0].$id);
  const profile = profileSlice.selectors.byId(
    clientStore.getState(),
    result[profileSlice.key][0].$id,
  );
  const contact = contactSlice.selectors.byId(
    clientStore.getState(),
    result[contactSlice.key][0].$id,
  );

  if (!user || !profile || !contact) {
    expect(user).toBeDefined();
    expect(profile).toBeDefined();
    expect(contact).toBeDefined();
    return;
  }

  expect(user).toEqual(result[userSlice.key][0]);
  expect(profile).toEqual(result[profileSlice.key][0]);
  expect(contact).toEqual(result[contactSlice.key][0]);
});
