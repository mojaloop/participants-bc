import { IParticipantSourceIpChangeRequest } from "@mojaloop/participant-bc-public-types-lib";

/**
 * To check sourceIpChangeRequest contains valid data
 * @param request 
 * @returns Promise<void>
 */
export const validateParticipantSourceIpChangeRequest = async (request: IParticipantSourceIpChangeRequest): Promise<void> => {
    try {
        if (request.cidr.trim().length === 0) {
            throw new Error(
                `CIDR cannot be empty.`
            );
        }

        if (!validateParticipantSourceIP_CIDR(request.cidr.trim())) {
            throw new Error(
                `Invalid CIDR format.`
            );
        }

        if(!validateParticipantSourceIP_PortMode(request.portMode)){
            throw new Error(
                `Invalid Port Mode.`
            );
        }

        if (request.portMode === "RANGE") {
            if (Number(request.portRange?.rangeFirst) === 0 || Number(request.portRange?.rangeFirst) === 0) {
                throw new Error(
                    `Invalid Port Range values.`
                );
            }

            if (!validateParticipantSourceIP_PortRange(Number(request.portRange?.rangeFirst), Number(request.portRange?.rangeLast))) {
                throw new Error(
                    `Invalid Port Range values.`
                );
            }
        }

        if (request.portMode === "SPECIFIC") {
            if (!validateParticipantSourceIP_Ports(request.ports)) {
                throw new Error(
                    `Invalid Port value.`
                );
            }
        }
        return Promise.resolve();
    } catch (error) {
        return Promise.reject(error);
    }
};


const validateParticipantSourceIP_CIDR = (input: string): boolean => {
    // Regular expression for CIDR notation validation
    const cidrRegex = /^(?:\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;

    // Check if the input matches the CIDR regex
    return cidrRegex.test(input);
}

const validateParticipantSourceIP_PortMode = (portMode: string): boolean => {
    return portMode === "ANY" || portMode === "SPECIFIC" || portMode === "RANGE";
};

const validateParticipantSourceIP_PortRange = (rangeFirst?: number | null, rangeLast?: number | null): boolean => {
    // Check if either both `rangeFirst` and `rangeLast` are null, or both are valid numbers
    if (
        !(rangeFirst === null && rangeLast === null) &&
        !(rangeFirst === 0 && rangeLast === 0) &&
        (!(typeof rangeFirst === 'number' && typeof rangeLast === 'number') ||
            rangeFirst >= rangeLast)
    ) {
        // Invalid port range
        return false;
    }
    // Valid port range
    return true;
};


const validateParticipantSourceIP_Ports = (portsArray: number[] | undefined): boolean => {

    if(!portsArray) {
        return false;
    }

    const portString = portsArray.join(",");

    // Regular expression for ports validation
    const portsRegex = /^([1-9]\d*)(,[1-9]\d*)*$/;

    if (!portsRegex.test(portString)) {
        return false;
    }

    // Check if each port in the array is a valid number
    for (const port of portsArray) {
        if (isNaN(port) || port < 1 || port > 65535) {
            // Invalid port number
            return false;
        }
    }

    // Valid ports array
    return true;
}