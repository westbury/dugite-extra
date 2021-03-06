import { git, IGitExecutionOptions } from '../core/git'
import { AppFileStatus, WorkingDirectoryFileChange } from '../model/status'
import { DiffType } from '../model/diff'
import { getWorkingDirectoryDiff } from './diff'
import { formatPatch } from '../parser/patch-formatter'

export async function applyPatchToIndex(repositoryPath: string, file: WorkingDirectoryFileChange, options?: IGitExecutionOptions): Promise<void> {

    // If the file was a rename we have to recreate that rename since we've
    // just blown away the index. Think of this block of weird looking commands
    // as running `git mv`.
    if (file.status === AppFileStatus.Renamed && file.oldPath) {
        // Make sure the index knows of the removed file. We could use
        // update-index --force-remove here but we're not since it's
        // possible that someone staged a rename and then recreated the
        // original file and we don't have any guarantees for in which order
        // partial stages vs full-file stages happen. By using git add the
        // worst that could happen is that we re-stage a file already staged
        // by updateIndex.
        await git(['add', '--u', '--', file.oldPath], repositoryPath, 'applyPatchToIndex');

        // Figure out the blob oid of the removed file
        // <mode> SP <type> SP <object> TAB <file>
        const oldFile = await git(['ls-tree', 'HEAD', '--', file.oldPath], repositoryPath, 'applyPatchToIndex');

        const [info] = oldFile.stdout.split('\t', 1);
        const [mode, , oid] = info.split(' ', 3);

        // Add the old file blob to the index under the new name
        await git(['update-index', '--add', '--cacheinfo', mode, oid, file.path], repositoryPath, 'applyPatchToIndex', options);
    }

    const applyArgs: string[] = ['apply', '--cached', '--unidiff-zero', '--whitespace=nowarn', '-'];

    const diff = await getWorkingDirectoryDiff(repositoryPath, file);

    if (diff.kind !== DiffType.Text) {
        throw new Error(`Unexpected diff result returned: '${diff.kind}'`);
    }
    let opts = {};
    if (options) {
        opts = {
            ...options
        };
    }
    const patch = await formatPatch(file, diff);
    opts = {
        ...opts,
        stdin: patch
    }
    await git(applyArgs, repositoryPath, 'applyPatchToIndex', opts);

}