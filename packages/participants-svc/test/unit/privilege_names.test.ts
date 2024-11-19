import { AppPrivilegesDefinition } from '../../src/application/privileges';
import { ParticipantPrivilegeNames } from '../../src/domain/privilege_names';

describe('AppPrivilegesDefinition', () => {
    it('should be defined', () => {
        expect(AppPrivilegesDefinition).toBeDefined();
    });

    it('should be an array', () => {
        expect(Array.isArray(AppPrivilegesDefinition)).toBe(true);
    });

    it('should have valid properties for each privilege definition', () => {
        AppPrivilegesDefinition.forEach(privilege => {
            expect(privilege).toHaveProperty('privId');
            expect(privilege).toHaveProperty('labelName');
            expect(privilege).toHaveProperty('description');

            expect(typeof privilege.privId).toBe('string');
            expect(typeof privilege.labelName).toBe('string');
            expect(typeof privilege.description).toBe('string');
        });
    });

    it('should reference valid privilege IDs from ParticipantPrivilegeNames', () => {
        const privilegeIds = Object.values(ParticipantPrivilegeNames);

        AppPrivilegesDefinition.forEach(privilege => {
            expect(privilegeIds).toContain(privilege.privId);
        });
    });

    it('should not have duplicate privilege IDs', () => {
        const privIds = AppPrivilegesDefinition.map(privilege => privilege.privId);
        const uniquePrivIds = new Set(privIds);
        expect(uniquePrivIds.size).toBe(privIds.length);
    });

    
});
