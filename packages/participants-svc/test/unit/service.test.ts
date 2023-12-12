// service.test.ts
import { ConsoleLogger, ILogger } from '@mojaloop/logging-bc-public-types-lib';
import { Service } from '../../src/application/service';
import { AccountsBalancesAdapterMock, AuditClientMock, AuthorizationClientMock, MemoryConfigClientMock, MemoryMessageProducer, ParticipantsRepoMock, TokenHelperMock } from '@mojaloop/participants-bc-shared-mocks-lib';
import { MetricsMock } from '@mojaloop/platform-shared-lib-observability-types-lib';

const packageJSON = require("../../package.json");


const APP_VERSION = packageJSON.version;
const SVC_DEFAULT_HTTP_PORT = 3010;
const AUTH_TOKEN = "bearer: MOCKTOKEN";

const authTokenUrl = "mocked_auth_url";
const hasPrivilege = true;

const server = process.env["PARTICIPANTS_SVC_URL"] || `http://localhost:${SVC_DEFAULT_HTTP_PORT}`;

// Create necessary mocks
const logger: ILogger = new ConsoleLogger();
const configClientMock = new MemoryConfigClientMock(logger, authTokenUrl);
const repoPartMock = new ParticipantsRepoMock();
const accAndBalAdapterMock = new AccountsBalancesAdapterMock();
const auditClientMock = new AuditClientMock(logger);
const authZClientMock = new AuthorizationClientMock(logger, hasPrivilege);
const msgProducerMock = new MemoryMessageProducer(logger);
const metricsMock = new MetricsMock();
const tokenHelperMock = new TokenHelperMock(logger);

describe('Service', () => {
  it('should start without errors', async () => {
   
      await expect(Service.start(logger,
          auditClientMock,
          authZClientMock,
          repoPartMock,
          accAndBalAdapterMock,
          msgProducerMock,
          undefined,
          metricsMock,
          undefined
      )).resolves.not.toThrow();
  });

  
});
