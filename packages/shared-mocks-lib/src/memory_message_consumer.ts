/**
 License
 --------------
 Copyright © 2021 Mojaloop Foundation

 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License.

 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list (alphabetical ordering) of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Gates Foundation organization for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Gates Foundation
 - Name Surname <name.surname@gatesfoundation.com>

 * Arg Software
 - José Antunes <jose.antunes@arg.software>
 - Rui Rocha <rui.rocha@arg.software>

 --------------
 **/

"use strict";

import {IMessage, IMessageConsumer} from "@mojaloop/platform-shared-lib-messaging-types-lib";

export class MemoryMessageConsumer implements IMessageConsumer{
      setBatchCallbackFn(_batchHandlerCallback: (messages: IMessage[]) => Promise<void>): void {
            return;
      }

      setBatchSize(size: number): void {
        return;
      }

      setCallbackFn(_handlerCallback: (message: IMessage) => Promise<void>): void {
            return;
      }

      setFilteringFn(_filterFn: (message: IMessage) => boolean): void{
            return;
      }

      setTopics(_topics: string[]): void {
         return;
      }

      async destroy(_force: boolean) : Promise<void>{
         return Promise.resolve();
      }

      async connect() : Promise<void> {
          return Promise.resolve();
      }

      async disconnect(_force: boolean) : Promise<void> {
          return Promise.resolve();
      }

      async start() : Promise<void> {
          return Promise.resolve();
      }

      async startAndWaitForRebalance() : Promise<void>{
            return Promise.resolve();
      }

      async stop (): Promise<void> {
          return Promise.resolve();
      }
}
