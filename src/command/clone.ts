import { git, IGitExecutionOptions } from '../core/git'
import { ICloneProgress } from '../progress'
import { CloneProgressParser, executionOptionsWithProgress } from '../progress'

/**
 * Additional arguments to provide when cloning a repository.
 */
export type CloneOptions = {

    /**
     * The branch to checkout after the clone has completed.
     */
    readonly branch?: string;
}

/**
 * Clones a repository from a given url into to the specified path.
 *
 * @param url     - The remote repository URL to clone from
 *
 * @param path    - The destination path for the cloned repository. If the
 *                  path does not exist it will be created. Cloning into an
 *                  existing directory is only allowed if the directory is
 *                  empty.
 *
 * @param cloneOptions  - Options specific to the clone operation, see the
 *                   documentation for CloneOptions for more details.
 *
 * @param progressCallback - An optional function which will be invoked
 *                           with information about the current progress
 *                           of the clone operation. When provided this enables
 *                           the '--progress' command line flag for
 *                           'git clone'.
 *
 */
export async function clone(
    url: string,
    path: string,
    cloneOptions: CloneOptions = {},
    options?: IGitExecutionOptions,
    progressCallback?: (progress: ICloneProgress) => void): Promise<void> {

    const args = [
        'clone', '--recursive', '--progress',
    ];

    let opts: IGitExecutionOptions = {};
    if (options) {
        opts = {
            ...options
        };
    }

    if (progressCallback) {
        args.push('--progress');

        const title = `Cloning into ${path}`;
        const kind = 'clone';

        opts = executionOptionsWithProgress(opts, new CloneProgressParser(), (progress) => {
            const description = progress.kind === 'progress'
                ? progress.details.text
                : progress.text;
            const value = progress.percent;

            progressCallback({ kind, title, description, value });
        });

        // Initial progress
        progressCallback({ kind, title, value: 0 });
    }

    if (cloneOptions.branch) {
        args.push('-b', cloneOptions.branch);
    }

    args.push('--', url, path);

    await git(args, __dirname, 'clone', opts);
}