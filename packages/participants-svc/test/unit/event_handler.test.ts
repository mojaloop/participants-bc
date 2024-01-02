// event_handler.test.ts

import { ConsoleLogger, ILogger } from '@mojaloop/logging-bc-public-types-lib';
import {
  AccountsBalancesAdapterMock,
  AuditClientMock,
  AuthorizationClientMock,
  MemoryConfigClientMock,
  MemoryMessageConsumer,
  MemoryMessageProducer,
  ParticipantsRepoMock,
  mockedParticipant1
} from "@mojaloop/participants-bc-shared-mocks-lib";
import { MetricsMock } from '@mojaloop/platform-shared-lib-observability-types-lib';
import { LoginHelper } from '@mojaloop/security-bc-client-lib';
import { ParticipantsEventHandler } from '../../src/application/event_handler';
import { ParticipantAggregate } from '../../src/domain/participant_agg';
import { UnauthorizedError } from '@mojaloop/security-bc-public-types-lib';
import { IMessage, MessageTypes } from '@mojaloop/platform-shared-lib-messaging-types-lib';
import { IParticipant } from '@mojaloop/participant-bc-public-types-lib';


const hasPrivilege = true;
const AUTH_N_SVC_BASEURL = process.env["AUTH_N_SVC_BASEURL"] || "http://localhost:3201";
const AUTH_N_SVC_TOKEN_URL = AUTH_N_SVC_BASEURL + "/token";
const SVC_CLIENT_ID = process.env["SVC_CLIENT_ID"] || "participants-bc-participants-svc";
const SVC_CLIENT_SECRET = process.env["SVC_CLIENT_SECRET"] || "superServiceSecret";
const AUTH_TOKEN = "bearer: MOCKTOKEN";
const authTokenUrl = "mocked_auth_url";

const logger: ILogger = new ConsoleLogger();
const repoPartMock = new ParticipantsRepoMock();
const accAndBalAdapterMock = new AccountsBalancesAdapterMock();
const auditClientMock = new AuditClientMock(logger);
const authZClientMock = new AuthorizationClientMock(logger, hasPrivilege);
const msgProducerMock = new MemoryMessageProducer(logger);
const msgConsumerMock = new MemoryMessageConsumer();
const metricsMock = new MetricsMock();
const configClientMock = new MemoryConfigClientMock(logger, authTokenUrl);


describe('ParticipantEventsHandler Unit Test', () => {

  const loginHelper = new LoginHelper(AUTH_N_SVC_TOKEN_URL, logger);
  loginHelper.setAppCredentials(SVC_CLIENT_ID, SVC_CLIENT_SECRET);

  const participantAggMock: ParticipantAggregate = new ParticipantAggregate(
    configClientMock,
    repoPartMock,
    accAndBalAdapterMock,
    auditClientMock,
    authZClientMock,
    msgProducerMock,
    metricsMock,
    logger
  );

  const mockedEventHandler: ParticipantsEventHandler = new ParticipantsEventHandler(
    msgConsumerMock,
    participantAggMock,
    loginHelper,
    logger
  )

  beforeAll(async () => {

  });

  afterAll(async () => {
    jest.clearAllMocks();

  });

  test("should be able to run start and init all variables", async () => {
    // Arrange
    const spyConsumerSetTopics = jest.spyOn(msgConsumerMock, "setTopics");
    const spyConsumerConnect = jest.spyOn(msgConsumerMock, "connect");
    const spyConsumerStart = jest.spyOn(msgConsumerMock, "connect");


    // Act
    await mockedEventHandler.start();

    // Assert
    expect(spyConsumerSetTopics).toBeCalledTimes(1);
    expect(spyConsumerConnect).toBeCalledTimes(1);
    expect(spyConsumerStart).toBeCalledTimes(1);

    await mockedEventHandler.stop();
  });

  test("should throw an UnauthorizedError if getToken returns null", async () => {

    // Arrange
    const fakeToken = null;
    const getTokenSpy = jest.spyOn(loginHelper, "getToken").mockResolvedValueOnce(fakeToken as any);

    // Act
    await mockedEventHandler.start();
    await expect(mockedEventHandler["_getServiceSecContext"]()).rejects.toThrow(UnauthorizedError);

    //Assert
    expect(getTokenSpy).toBeCalledTimes(1);
    await mockedEventHandler.stop();
  });

  test("should return a CallSecurityContext object with the correct properties", async () => {
    // Arrange
    const fakeToken = {
      payload: {
        azp: "mocked_client_id",
        platformRoles: ["mocked_role_id"],
      },
      accessToken: "mocked_access_token",
    };
    const getTokenSpy = jest.spyOn(loginHelper, "getToken").mockResolvedValueOnce(fakeToken as any);

    await mockedEventHandler.start();
    // Act
    const secCtx = await mockedEventHandler["_getServiceSecContext"]();

    // Assert
    expect(secCtx.clientId).toBe(fakeToken.payload.azp);
    expect(secCtx.accessToken).toBe(fakeToken.accessToken);
    expect(secCtx.platformRoleIds).toBe(fakeToken.payload.platformRoles);
    expect(secCtx.username).toBeNull();
    expect(getTokenSpy).toBeCalledTimes(1);

    await mockedEventHandler.stop();
  });


  test("should be able to run stop", async () => {
    // Arrange
    const spyConsumerStopMethod = jest.spyOn(msgConsumerMock, "stop");
    await mockedEventHandler.start();

    // Act
    await mockedEventHandler.stop();

    // Assert
    expect(spyConsumerStopMethod).toBeCalledTimes(1);

  });

});