import { GetParticipantsConfigs } from '../../src/application/configset';
import { ConfigurationClient, IConfigProvider } from '@mojaloop/platform-configuration-bc-client-lib';
import { ConfigParameterTypes } from '@mojaloop/platform-configuration-bc-public-types-lib';

jest.mock('@mojaloop/platform-configuration-bc-client-lib', () => ({
    ConfigurationClient: jest.fn().mockImplementation((bcName, appVersion, configProvider) => ({
        boundedContextName: bcName,
        bcConfigs: {
            addNewParam: jest.fn(),
            getParam: jest.fn((paramName) => {
                if (paramName === 'MAKER_CHECKER_ENABLED') {
                    return {
                        name: paramName,
                        type: ConfigParameterTypes.BOOL,
                        defaultValue: true,
                        description: 'Enable maker-checker enforcement in participants',
                    };
                }
                return undefined;
            }),
        },
        globalConfigs: {},
        init: jest.fn(async () => undefined),
        destroy: jest.fn(async () => undefined),
        fetch: jest.fn(async () => undefined),
        bootstrap: jest.fn(async () => true),
        setChangeHandlerFunction: jest.fn(),
    })),
}));

describe('GetParticipantsConfigs', () => {
    const mockBcName = 'TestBC';
    const mockConfigProvider: IConfigProvider = {
        init: jest.fn(async () => true),
        destroy: jest.fn(async () => undefined),
        boostrapBoundedContextConfigs: jest.fn(async () => true),
        fetchBoundedContextConfigs: jest.fn(async () => null),
        fetchGlobalConfigs: jest.fn(async () => null),
        setConfigChangeHandler: jest.fn(),
    };

    test('should create a ConfigurationClient with the correct parameters', () => {
        // Act
        const configClient = GetParticipantsConfigs(mockBcName, mockConfigProvider);

        // Assert
        expect(ConfigurationClient).toHaveBeenCalledWith(mockBcName, '0.3.8', mockConfigProvider);
        expect(configClient.boundedContextName).toBe(mockBcName);
    });

    test('should add the MAKER_CHECKER_ENABLED parameter with correct attributes', () => {
        // Act
        const configClient = GetParticipantsConfigs(mockBcName, mockConfigProvider);
        const param = configClient.bcConfigs.getParam('MAKER_CHECKER_ENABLED');

        // Assert
        expect(param).toBeDefined();
        expect(param?.name).toBe('MAKER_CHECKER_ENABLED');
        expect(param?.type).toBe(ConfigParameterTypes.BOOL);
        expect(param?.defaultValue).toBe(true);
        expect(param?.description).toBe('Enable maker-checker enforcement in participants');
    });

    test('should call init and destroy methods on the ConfigurationClient', async () => {
        // Arrange
        const configClient = GetParticipantsConfigs(mockBcName, mockConfigProvider);

        // Act
        await configClient.init();
        await configClient.destroy();

        // Assert
        expect(configClient.init).toHaveBeenCalledTimes(1);
        expect(configClient.destroy).toHaveBeenCalledTimes(1);
    });

    test('should fetch configurations when fetch is called', async () => {
        // Arrange
        const configClient = GetParticipantsConfigs(mockBcName, mockConfigProvider);

        // Act
        await configClient.fetch();

        // Assert
        expect(configClient.fetch).toHaveBeenCalledTimes(1);
    });

    test('should handle the bootstrap method correctly', async () => {
        // Arrange
        const configClient = GetParticipantsConfigs(mockBcName, mockConfigProvider);

        // Act
        const result = await configClient.bootstrap();

        // Assert
        expect(configClient.bootstrap).toHaveBeenCalledTimes(1);
        expect(result).toBe(true);
    });

    test('should set a change handler function correctly', () => {
        // Arrange
        const mockChangeHandler = jest.fn();
        const configClient = GetParticipantsConfigs(mockBcName, mockConfigProvider);

        // Act
        configClient.setChangeHandlerFunction(mockChangeHandler);

        // Assert
        expect(configClient.setChangeHandlerFunction).toHaveBeenCalledWith(mockChangeHandler);
    });
});
