/*****
 License
 --------------
 Copyright © 2017 Bill & Melinda Gates Foundation
 The Mojaloop files are made available by the Bill & Melinda Gates Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list (alphabetical ordering) of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Gates Foundation organization for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Arg Software
 - José Antunes <jose.antunes@arg.software>
 - Rui Rocha <rui.rocha@arg.software>

 --------------
 ******/

 "use strict";
 
import { ConsoleLogger, ILogger } from "@mojaloop/logging-bc-public-types-lib";
import { IAuthenticatedHttpRequester } from "@mojaloop/security-bc-public-types-lib";
import { ParticipantsHttpClient } from "../../src/participants_http_client";
import { mockedParticipant1, mockedParticipant2, MemoryMessageConsumer } from "@mojaloop/participants-bc-shared-mocks-lib";
import {
    IMessage,
    IMessageConsumer,
    MessageTypes
} from "@mojaloop/platform-shared-lib-messaging-types-lib";
import { ParticipantChangedEvt } from "@mojaloop/platform-shared-lib-public-messages-lib";
import { UnableToGetParticipantsError } from "../../src/errors";

// Mock ILogger and IAuthenticatedHttpRequester for testing
const mockLogger: ILogger = new ConsoleLogger();

type MockedIAuthenticatedHttpRequester = IAuthenticatedHttpRequester & {
    fetch: jest.Mock<Promise<Response>, [RequestInfo, (number | undefined)?]>;
};

const mockAuthRequester: MockedIAuthenticatedHttpRequester = {
    initialised: true,
    setUserCredentials: jest.fn(),
    setAppCredentials: jest.fn(),
    fetch: jest.fn()
};

const mockMessageConsumer: IMessageConsumer = new MemoryMessageConsumer();

const DEFAULT_CACHE_TIMEOUT_MS = 1*60*1000;

const PARTICIPANTS_BASE_URL="http://localhost:3010";

let httpClient = new ParticipantsHttpClient(mockLogger, PARTICIPANTS_BASE_URL, mockAuthRequester, DEFAULT_CACHE_TIMEOUT_MS, mockMessageConsumer);

jest.setTimeout(10000);

describe('Unit tests - Participants Client lib', () => {
    let originalClearInterval: any;

    beforeEach(() => {
        originalClearInterval = global.clearInterval;

        mockAuthRequester.fetch.mockResolvedValue(new Response(JSON.stringify({
            items: [mockedParticipant1, mockedParticipant2],
            pageIndex: 0,
            pageSize: 2,
            totalPages: 1
        }), {
            status: 200,
            headers: {'Content-Type': 'application/json'}
        }));

        jest.spyOn(global, 'clearInterval').mockImplementation(originalClearInterval);
    });

    afterEach(() => {
        global.clearInterval = originalClearInterval;
        
        jest.restoreAllMocks();
    });

    afterAll(() => {
        httpClient.destroy()
    });

    it('should process and cache participants when fetch returns status 200', async () => {
        // Arrange
        const participantsData = [mockedParticipant1, mockedParticipant2];
        mockAuthRequester.fetch.mockResolvedValue(new Response(JSON.stringify(participantsData), {
            status: 200,
            headers: {'Content-Type': 'application/json'}
        }));

        jest.spyOn(httpClient, "_cacheSet");

        // Act
        const idsToFetch = [mockedParticipant1.id, mockedParticipant2.id];
        const result = await httpClient.getParticipantsByIds(idsToFetch);

        // Assert
        expect(mockAuthRequester.fetch).toHaveBeenCalled();
        expect(httpClient._cacheSet).toHaveBeenCalledWith(participantsData);
        expect(result).toEqual(participantsData);
        expect(result).toHaveLength(participantsData.length);
    });

    it('should initialize the ParticipantsHttpClient and fetch all participants', async () => {
        // Arrange
        jest.spyOn(mockMessageConsumer, "setTopics")
        jest.spyOn(mockMessageConsumer, "connect")
        jest.spyOn(mockMessageConsumer, "setCallbackFn")
        jest.spyOn(mockMessageConsumer, "startAndWaitForRebalance")

        // Act
        await httpClient.init();

        // Assert
        expect(mockAuthRequester.fetch).toHaveBeenCalledWith(expect.stringContaining('/participants'));
        expect(mockMessageConsumer.setTopics).toHaveBeenCalled();
        expect(mockMessageConsumer.connect).toHaveBeenCalled();
        expect(mockMessageConsumer.setCallbackFn).toHaveBeenCalled();
        expect(mockMessageConsumer.startAndWaitForRebalance).toHaveBeenCalled();
    });

    it('should handle errors during initialization', async () => {
        // Arrange
        mockAuthRequester.fetch = jest.fn().mockRejectedValue(new Error('Fetch error'));
        jest.spyOn(mockLogger, "error");

        // Act & Assert
        await expect(httpClient.init()).rejects.toThrow('Fetch error');
        expect(mockLogger.error).toHaveBeenCalledWith('Failed to initialize ParticipantsHttpClient', expect.any(Error));
    });

    it('should start refresh timer', async () => {
        // Arrange
        jest.useFakeTimers();
        jest.spyOn(global, 'setInterval');
    
        // Act
        await httpClient.init();
    
        // Assert
        expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 60000);
    
        // Cleanup
        jest.useRealTimers();
    });

    it('should clear the refresh timer and log completion on destroy', async () => {
        // Arrange
        httpClient["_refreshTimer"] = global.setInterval(() => {}, 1000);
        
        jest.spyOn(mockLogger, 'info');

        // Act
        await httpClient.destroy();

        // Assert
        expect(clearInterval).toHaveBeenCalledWith(httpClient["_refreshTimer"]);
        expect(mockLogger.info).toHaveBeenCalledWith("Destroying ParticipantsHttpClient");
        expect(mockLogger.info).toHaveBeenCalledWith("ParticipantsHttpClient destroy completed");
    });

    it('should handle errors during destruction and log appropriately', async () => {
        // Arrange
        const error = new Error("Error during destruction");
    
        jest.restoreAllMocks();
    
        httpClient["_refreshTimer"] = setTimeout(() => {}, 1000);
    
        global.clearInterval = jest.fn().mockImplementation(() => {
            throw error;
        });
    
        jest.spyOn(mockLogger, 'error');
    
        // Act & Assert
        await expect(httpClient.destroy()).rejects.toThrow("Error during destruction");

        expect(mockLogger.error).toHaveBeenCalledWith("Failed to destroy ParticipantsHttpClient", error);
        expect(global.clearInterval).toHaveBeenCalled();
    });
    
    it('should do nothing if no refresh timer is set', async () => {
        // Arrange
        httpClient["_refreshTimer"] = null;

        jest.spyOn(mockLogger, 'info');

        // Act
        await httpClient.destroy();

        // Assert
        expect(clearInterval).not.toHaveBeenCalled();
        expect(mockLogger.info).toHaveBeenCalledWith("Destroying ParticipantsHttpClient");
        expect(mockLogger.info).toHaveBeenCalledWith("ParticipantsHttpClient destroy completed");
    });

    it('should set participant in cache', async () => {
        // Arrange
        const participant = mockedParticipant1;
        
        // Act
        await httpClient._cacheSet(participant);
        
        const result = await httpClient._cacheGet(mockedParticipant1.id);
        
        // Assert
        expect(result).toEqual(participant);
    });

    it('should set multiple participants in cache', async () => {
        // Arrange
        const participants = [mockedParticipant1, mockedParticipant2];
    
        // Act
        await httpClient._cacheSet(participants);
    
        // Assert
        expect(httpClient["_participantsCache"].size).toBe(2);
    });

    it('should get participant from cache if not expired', async () => {
        // Arrange
        const participant = mockedParticipant1;
        
        
        // Act
        await httpClient._cacheSet(participant);
        
        const result = await httpClient._cacheGet(mockedParticipant1.id);
    
        // Assert
        expect(result).toEqual(participant);
    });

    it('should return null if participant not found in cache', async () => {    
        // Act
        const result = await httpClient._cacheGet('nonExistentParticipantId');
    
        // Assert
        expect(result).toBeNull();
    });

    

    it('should delete participant from cache if expired', async () => {
        // Arrange
        const participant = mockedParticipant1;
       
        await httpClient._cacheSet(participant);
        jest.useFakeTimers(); 
    
        // Act
        jest.advanceTimersByTime(DEFAULT_CACHE_TIMEOUT_MS + 1);
    
        const result = await httpClient._cacheGet(mockedParticipant1.id);
        
        // Assert
        expect(result).toBeNull();
    
        jest.useRealTimers();  
    });

    it('should fetch from API and cache if not found in cache', async () => {

        const participantId = 'test-id';
        
        jest.spyOn(httpClient, '_cacheGet').mockResolvedValue(null);

        jest.spyOn(httpClient, '_cacheSet');

        mockAuthRequester.fetch.mockResolvedValue(new Response(JSON.stringify(mockedParticipant1), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        }));
    
        const result = await httpClient.getParticipantById(participantId);
    
        expect(result).toEqual(mockedParticipant1);
        expect(mockAuthRequester.fetch).toHaveBeenCalledWith(expect.stringContaining(`/participants/${participantId}`));
        expect(httpClient._cacheSet).toHaveBeenCalledWith(mockedParticipant1);
    });

    it('should return null if participant is not found (404 status)', async () => {
        const participantId = 'test-id';
        jest.spyOn(httpClient, '_cacheGet').mockResolvedValue(null);
        mockAuthRequester.fetch.mockResolvedValue(new Response(null, {
            status: 404
        }));
    
        const result = await httpClient.getParticipantById(participantId);
    
        expect(result).toBeNull();
    });

    it('should throw UnableToGetParticipantsError if response status is not 200 or 404', async () => {
        const participantId = 'test-id';
        jest.spyOn(httpClient, '_cacheGet').mockResolvedValue(null);
        mockAuthRequester.fetch.mockResolvedValue(new Response(null, {
            status: 500
        }));
    
        await expect(httpClient.getParticipantById(participantId)).rejects.toThrow(UnableToGetParticipantsError);
    });

    it('should handle errors when fetching participant by ID', async () => {
        // Arrange
        const participants = [mockedParticipant1, mockedParticipant2];
        const mockAuthRequesterWithError: IAuthenticatedHttpRequester = {
            initialised: true,
            setUserCredentials: jest.fn(),
            setAppCredentials: jest.fn(),
            fetch: jest.fn().mockResolvedValue(new Response(JSON.stringify({
                items: participants,
                pageIndex: 1,
                pageSize: 2,
                totalPages: 1
            })))
        };
        
        const httpClientWithError = new ParticipantsHttpClient(mockLogger, 'baseUrl', mockAuthRequesterWithError);
    
        // Act & Assert
        await expect(httpClientWithError.getParticipantById('id')).rejects.toThrow();
    });

    it('should return empty results when response is 404', async () => {

        mockAuthRequester.fetch.mockResolvedValue(new Response(JSON.stringify({}), {
            status: 404,
        }));

        const result = await httpClient.getAllParticipants();

        expect(result).toEqual({ pageIndex: 0, pageSize: 0, totalPages: 0, items: [] });
    });

    it('should throw UnableToGetParticipantsError for non-200 and non-404 responses', async () => {
        mockAuthRequester.fetch.mockResolvedValue(new Response(JSON.stringify({}), {
            status: 500,
        }));

        await expect(httpClient.getAllParticipants()).rejects.toThrow(UnableToGetParticipantsError);
    });

    it('should fetch all participants and cache them when response is 200', async () => {
        // Arrange
        const participants = [mockedParticipant1, mockedParticipant2];

        jest.spyOn(httpClient, "_cacheSet");
        
        // Act
        const result = await httpClient.getAllParticipants();

        // Assert
        expect(result).toEqual({ pageIndex: 0, pageSize: 2, totalPages: 1, items: participants });
        expect(httpClient._cacheSet).toHaveBeenCalledTimes(participants.length);
        participants.forEach(participant => {
            expect(httpClient._cacheSet).toHaveBeenCalledWith(participant);
        });
    });
    
    it('should handle errors when fetching all participants', async () => {
        // Arrange
        const mockAuthRequesterWithError: IAuthenticatedHttpRequester = {
            initialised: true,
            setUserCredentials: jest.fn(),
            setAppCredentials: jest.fn(),
            fetch: jest.fn().mockResolvedValue({ status: 500 })
        };
        const result = new ParticipantsHttpClient(mockLogger, 'baseUrl', mockAuthRequesterWithError);
    
        // Act & Assert
        await expect(result.getAllParticipants()).rejects.toThrow();
    });

    it('should return participants from cache', async () => {
        // Arrange
        const participants = [mockedParticipant1];

        // Act
        await httpClient._cacheSet(participants);

        const result = await httpClient.getParticipantsByIds([mockedParticipant1.id]);

        // Assert
        expect(result).toEqual(participants);
        expect(mockAuthRequester.fetch).not.toHaveBeenCalled();
    });

    it('should fetch from API if not found in cache and cache them', async () => {
        // Arrange
        mockAuthRequester.fetch.mockResolvedValue(new Response(JSON.stringify([mockedParticipant1]), {
            status: 200,
            headers: {'Content-Type': 'application/json'}
        }));

        jest.spyOn(httpClient, "_cacheSet");
        
        // Act
        const result = await httpClient.getParticipantsByIds(['2']);

        // Assert
        expect(httpClient._cacheSet).toHaveBeenCalled();
        expect(result).toEqual([mockedParticipant1]);
    });

    it('handles multiple retries and fails with UnableToGetParticipantsError after max retries', async () => {
        // Arrange
        mockAuthRequester.fetch.mockResolvedValue(new Response(JSON.stringify(null), {
            status: 500,
        }));

        jest.spyOn(mockLogger, "error");
        
        // Act & Assert
        await expect(httpClient.getParticipantsByIds(['3']))
            .rejects.toThrow(UnableToGetParticipantsError);

        expect(mockAuthRequester.fetch).toHaveBeenCalledTimes(3);
        expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle 404 by returning cached results', async () => {
        // Arrange
        mockAuthRequester.fetch.mockResolvedValue(new Response(JSON.stringify(null), {
            status: 404,
        }));
        
        jest.spyOn(mockLogger, "warn");

        // Act
        const result = await httpClient.getParticipantsByIds(['4']);
        
        // Assert
        expect(result).toEqual([]);
    });

    it('should handle errors when fetching participants by IDs', async () => {
        // Arrange
        const mockAuthRequesterWithError: IAuthenticatedHttpRequester = {
            initialised: true,
            setUserCredentials: jest.fn(),
            setAppCredentials: jest.fn(),
            fetch: jest.fn().mockResolvedValue({ status: 500 })
        };
        const httpClientWithError = new ParticipantsHttpClient(mockLogger, 'baseUrl', mockAuthRequesterWithError);
    
        // Act & Assert
        await expect(httpClientWithError.getParticipantsByIds(["id1', 'id2"])).rejects.toThrow();
    });

    it('should return participant accounts when found (status 200)', async () => {
        // Arrange
        const participantId = 'test-participant-id';
        const accounts = [{ id: 'account1', type: 'checking' }];

        mockAuthRequester.fetch.mockResolvedValue(new Response(JSON.stringify(accounts), {
            status: 200,
            headers: {'Content-Type': 'application/json'}
        }));

        // Act
        const result = await httpClient.getParticipantAccountsById(participantId);

        // Assert
        expect(result).toEqual(accounts);
        expect(mockAuthRequester.fetch).toHaveBeenCalledWith(`${PARTICIPANTS_BASE_URL}/participants/${participantId}/accounts`);
    });

    it('should return an empty array if participant accounts not found (status 404)', async () => {
        // Arrange
        const participantId = 'test-participant-id';
        mockAuthRequester.fetch.mockResolvedValue(new Response(JSON.stringify([]), {
            status: 404,
            headers: {'Content-Type': 'application/json'}
        }));

        // Act
        const result = await httpClient.getParticipantAccountsById(participantId);

        // Assert
        expect(result).toEqual([]);
    });

    it('should throw UnableToGetParticipantsError for other errors', async () => {
        // Arrange
        const participantId = 'test-participant-id';

        mockAuthRequester.fetch.mockResolvedValue(new Response(null, {
            status: 500,
            headers: {'Content-Type': 'application/json'}
        }));

        // Act & Assert
        await expect(httpClient.getParticipantAccountsById(participantId))
            .rejects.toThrow(UnableToGetParticipantsError);
    });

    it('should rethrow the error if it is an instance of Error', async () => {
        // Arrange
        const participantId = 'test-participant-id';
        const error = new Error('Network error');

        mockAuthRequester.fetch.mockRejectedValue(error);

        // Act & Assert
        await expect(httpClient.getParticipantAccountsById(participantId))
            .rejects.toThrow(error);
    });

    it('should handle errors when fetching participant accounts by ID', async () => {
        // Arrange
        const mockAuthRequesterWithError: IAuthenticatedHttpRequester = {
            initialised: true,
            setUserCredentials: jest.fn(),
            setAppCredentials: jest.fn(),
            fetch: jest.fn().mockResolvedValue({ status: 500 })
        };
        const httpClientWithError = new ParticipantsHttpClient(mockLogger, 'baseUrl', mockAuthRequesterWithError);
    
        // Act & Assert
        await expect(httpClientWithError.getParticipantAccountsById('id')).rejects.toThrow();
    });

    it('should refresh expired participants by calling getParticipantsByIds with expired IDs', async () => {
        // Arrange
        const participant = mockedParticipant1;
        const expiredParticipant = mockedParticipant2;

        await httpClient._cacheSet([participant, expiredParticipant]);

        httpClient["_participantsCache"].set(expiredParticipant.id, {
            participant: expiredParticipant,
            timestamp: Date.now() - 2 * 60 * 1000
        });

        const spyGetParticipantsByIds = jest.spyOn(httpClient, 'getParticipantsByIds').mockResolvedValue([expiredParticipant]);

        // Act
        const expiredIds = await httpClient.refreshParticipants();

        // Assert
        expect(expiredIds).toEqual([expiredParticipant.id]);
        expect(spyGetParticipantsByIds).toHaveBeenCalledWith([expiredParticipant.id]);
        spyGetParticipantsByIds.mockRestore();
    });

    it('should return an empty array if no participants are expired', async () => {
        // Arrange
        const participant = mockedParticipant1;

        await httpClient._cacheSet(participant);

        const spyGetParticipantsByIds = jest.spyOn(httpClient, 'getParticipantsByIds');

        // Act
        const expiredIds = await httpClient.refreshParticipants();

        // Assert
        expect(expiredIds).toEqual([]);
        expect(spyGetParticipantsByIds).not.toHaveBeenCalled();
        spyGetParticipantsByIds.mockRestore();
    });


    it('should not fetch participant when message type is not DOMAIN_EVENT', async () => {
        // Arrange
        const mockMessage = {
            msgType: MessageTypes.STATE_EVENT,
            msgName: ParticipantChangedEvt.name,
            payload: { participantId: 'mockParticipantId' }
        } as IMessage;

        jest.spyOn(httpClient, "getParticipantById")

        // Act
        await httpClient["_messageHandler"](mockMessage);

        // Assert
        expect(httpClient.getParticipantById).not.toHaveBeenCalled();
    });

    it('should not fetch participant when message name is not ParticipantChangedEvt', async () => {
        // Arrange
        const mockMessage = {
            msgType: MessageTypes.DOMAIN_EVENT,
            msgName: 'OtherEvent',
            payload: { participantId: 'mockParticipantId' }
        } as IMessage;

        jest.spyOn(httpClient, "getParticipantById")

        // Act
        await httpClient["_messageHandler"](mockMessage);

        // Assert
        expect(httpClient.getParticipantById).not.toHaveBeenCalled();
    });

    it('should process ParticipantChangedEvt and update participant cache', async () => {
        // Arrange
        const participantId = mockedParticipant1.id;
        const participant = mockedParticipant1;
        const message = {
            msgType: MessageTypes.DOMAIN_EVENT,
            msgName: ParticipantChangedEvt.name,
            payload: { participantId }
        } as IMessage;

        jest.spyOn(httpClient, "getParticipantById").mockResolvedValue(participant);

        jest.spyOn(mockLogger, "info");

        // Act
        await httpClient["_messageHandler"](message);

        jest.advanceTimersByTime(6000); // TODO: Should work, but it doesn't, use below solution for now

        await new Promise((r) => setTimeout(r, 6000));

        // Assert
        expect(httpClient.getParticipantById).toHaveBeenCalledWith(participantId);
        expect(mockLogger.info).toHaveBeenCalledWith(`Updated participant with ID ${participantId} cached successfully.`);
    });

    it('should log an error if updating participant cache fails', async () => {
        // Arrange
        const participantId = mockedParticipant1.id;
        const error = new Error('Test Error');
        const message = {
            msgType: MessageTypes.DOMAIN_EVENT,
            msgName: ParticipantChangedEvt.name,
            payload: { participantId }
        } as IMessage;

        jest.spyOn(httpClient, "getParticipantById").mockRejectedValue(error);

        jest.spyOn(mockLogger, "error");

        // Act
        await httpClient["_messageHandler"](message);
       
        jest.advanceTimersByTime(6000); // TODO: Should work, but it doesn't, use below solution for now

        await new Promise((r) => setTimeout(r, 6000));

        // Assert
        expect(mockLogger.error).toHaveBeenCalledWith("Failed to update participant cache from event", error);
    });
});

