import * as temp from 'temp';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import { expect } from 'chai';
import { getStatus } from './status';
import { FileStatus } from '../model/status';
import { createTestRepository, add, remove, modify } from './test-helper';
import { clone } from './clone';


const track = temp.track();

describe('status', async () => {

    const repositoryWithChanges = path.join(os.homedir(), '.git');

    before(async function () {
        this.timeout(80000);
        if (fs.existsSync(repositoryWithChanges)) {
            fs.removeSync(repositoryWithChanges);
        }
        await clone('https://github.com/eclipse/xtext-core.git', repositoryWithChanges);
        const tmpPath = path.join(repositoryWithChanges, 'tmp');
        fs.mkdirpSync(tmpPath);
        fs.readdirSync(repositoryWithChanges).forEach(fileName => {
            if (fileName.startsWith('org.eclipse.xtext')) {
                fs.moveSync(path.join(repositoryWithChanges, fileName), path.join(tmpPath, fileName));
            }
        });
    })

    after(async () => {
        track.cleanupSync();
        fs.removeSync(repositoryWithChanges);
    });

    it('missing', async () => {
        try {
            await getStatus('/does/not/exist');
            throw new Error('Expected error when getting status from a non-existing repository.');
        } catch (error) {
            expect(error.message).to.be.equal('Unable to find path to repository on disk.');
        }
    });

    it('empty', async () => {
        const repositoryPath = await createTestRepository(track.mkdirSync());
        const status = await getStatus(repositoryPath);

        expect(status.workingDirectory.files).to.be.empty;
    });

    it('new', async () => {
        const repositoryPath = await createTestRepository(track.mkdirSync());
        const filePaths = add(repositoryPath, { path: 'X.txt' })

        const status = await getStatus(repositoryPath);
        const files = status.workingDirectory.files;
        expect(files).to.have.lengthOf(1);
        expect(files[0].path).to.be.equal(path.relative(repositoryPath, filePaths[0]));
        expect(files[0].status).to.be.equal(FileStatus.New);
    });

    it('deleted', async () => {
        const repositoryPath = await createTestRepository(track.mkdirSync());
        const filePaths = remove(repositoryPath, 'A.txt');

        const status = await getStatus(repositoryPath);
        const files = status.workingDirectory.files;
        expect(files).to.have.lengthOf(1);
        expect(files[0].path).to.be.equal(path.relative(repositoryPath, filePaths[0]));
        expect(files[0].status).to.be.equal(FileStatus.Deleted);
    });

    it('modified', async () => {
        const repositoryPath = await createTestRepository(track.mkdirSync());
        const filePaths = modify(repositoryPath, { path: 'A.txt', data: 'content' });

        const status = await getStatus(repositoryPath);
        const files = status.workingDirectory.files;
        expect(files).to.have.lengthOf(1);
        expect(files[0].path).to.be.equal(path.relative(repositoryPath, filePaths[0]));
        expect(files[0].status).to.be.equal(FileStatus.Modified);
    });

    it('in repository with changes', async function () {
        this.timeout(1000);
        const status = await getStatus(repositoryWithChanges);
        expect(status.workingDirectory.files.length > 10000);
        expect(!!status.incomplete).to.be.false;
    });

    it('limit changes', async function () {
        this.timeout(1000);
        const status = await getStatus(repositoryWithChanges, false, 500);
        expect(status.workingDirectory.files.length === 500);
        expect(status.incomplete).to.be.true;
    });

});
