import { expect } from 'chai';
import path from 'path';
import Helper from '../e2e-helper';
import {
  statusFailureMsg,
  statusInvalidComponentsMsg,
  statusWorkspaceIsCleanMsg
} from '../../src/cli/commands/public-cmds/status-cmd';

describe('environments with dependencies', function () {
  this.timeout(0);
  const helper = new Helper();
  const compilerId = 'compilers/webpack';
  let scopeBeforeTagging;
  before(() => {
    helper.setNewLocalAndRemoteScopes();
    const compiler = path.join('compilers', 'new-babel', 'compiler.js');
    helper.copyFixtureFile(compiler);
    helper.addComponentWithOptions('compiler.js', {
      i: compilerId
    });
    helper.reInitEnvsScope();
    helper.addRemoteEnvironment();
    helper.addNpmPackage('babel-core', '6.26.3');
    helper.addNpmPackage('fs-extra', '5.0.0');
    helper.addNpmPackage('mocha', '5.1.1');
    helper.addNpmPackage('vinyl', '2.1.0');
    helper.addNpmPackage('resolve', '1.7.1');
    helper.tagAllWithoutMessage();
    helper.exportAllComponents(helper.envScope);
    helper.reInitLocalScope();
    helper.addRemoteScope();
    helper.initNpm();
    helper.addRemoteEnvironment();
    helper.importCompiler(`${helper.envScope}/${compilerId}`);
    helper.copyFixtureFile(path.join('compilers', 'webpack', 'base.config.js'));
    helper.copyFixtureFile(path.join('compilers', 'webpack', 'dev.config.js'));
    helper.addNpmPackage('webpack-merge', '4.1.4');
    helper.addNpmPackage('webpack', '4.16.5');
    helper.createComponentBarFoo();
    helper.addComponentBarFoo();
    scopeBeforeTagging = helper.cloneLocalScope();
  });
  after(() => {
    helper.destroyEnv();
  });
  describe('when a dependency file is not included in bit.json', () => {
    before(() => {
      helper.addFileToEnvInBitJson(undefined, 'dev.config.js', './dev.config.js', 'compiler');
    });
    it('should show the dependency file as untracked', () => {
      const output = helper.runCmd('bit status');
      expect(output).to.have.string(statusFailureMsg);
      expect(output).to.have.string('untracked');
      expect(output).to.have.string('dev.config.js -> base.config.js');
    });
  });
  describe('when a dependency file is not in the file system', () => {
    before(() => {
      helper.getClonedLocalScope(scopeBeforeTagging);
      helper.deleteFile('base.config.js');
      helper.addFileToEnvInBitJson(undefined, 'base.config.js', './base.config.js', 'compiler');
      helper.addFileToEnvInBitJson(undefined, 'dev.config.js', './dev.config.js', 'compiler');
    });
    it('should show the component as an invalid component', () => {
      const output = helper.runCmd('bit status');
      expect(output).to.have.string(statusInvalidComponentsMsg);
      expect(output).to.have.string('extension file is missing');
    });
  });
  describe('when all files exist and included in bit.json', () => {
    before(() => {
      helper.getClonedLocalScope(scopeBeforeTagging);
      helper.addFileToEnvInBitJson(undefined, 'base.config.js', './base.config.js', 'compiler');
      helper.addFileToEnvInBitJson(undefined, 'dev.config.js', './dev.config.js', 'compiler');
    });
    it('bit status should not show any missing', () => {
      const output = helper.runCmd('bit status');
      expect(output).to.not.have.string(statusFailureMsg);
      expect(output).to.not.have.string(statusInvalidComponentsMsg);
    });
  });
  describe('when a dependency file is a Bit component', () => {
    before(() => {
      helper.getClonedLocalScope(scopeBeforeTagging);
      helper.addFileToEnvInBitJson(undefined, 'dev.config.js', './dev.config.js', 'compiler');

      helper.addNpmPackage('webpack', '4.16.4');
      helper.addComponentWithOptions('base.config.js', { i: 'webpack/base' });
    });
    it('bit status should not show any missing', () => {
      const output = helper.runCmd('bit status');
      expect(output).to.not.have.string(statusFailureMsg);
      expect(output).to.not.have.string(statusInvalidComponentsMsg);
    });
    it('bit show should show compiler dependency', () => {
      const showJson = helper.showComponentParsed('bar/foo');
      expect(showJson)
        .to.have.property('compilerDependencies')
        .that.is.an('array');
      expect(showJson.compilerDependencies).to.have.lengthOf(1);
      const envDependency = showJson.compilerDependencies[0];
      expect(envDependency.id).to.equal('webpack/base');
    });
    it('bit show should show compiler package dependency', () => {
      const showJson = helper.showComponentParsed('bar/foo');
      expect(showJson).to.have.property('compilerPackageDependencies');
      expect(showJson.compilerPackageDependencies).to.have.property('webpack-merge');
    });
    describe('after tagging the components', () => {
      let catComponent;
      before(() => {
        const output = helper.tagAllWithoutMessage();
        expect(output).to.have.string('2 components tagged');
        catComponent = helper.catComponent('bar/foo@latest');
      });
      it('should save the compilerDependencies in the model', () => {
        expect(catComponent).to.have.property('compilerDependencies');
        expect(catComponent.compilerDependencies).to.have.lengthOf(1);
        const envDependency = catComponent.compilerDependencies[0];
        expect(envDependency.id.name).to.equal('webpack/base');
        expect(envDependency.id.version).to.equal('0.0.1');
        expect(envDependency.relativePaths).to.have.lengthOf(1);
        const relativePath = envDependency.relativePaths[0];
        expect(relativePath.sourceRelativePath).to.equal('base.config.js');
        expect(relativePath.destinationRelativePath).to.equal('base.config.js');
      });
      it('should save the flattenedCompilerDependencies in the model', () => {
        expect(catComponent).to.have.property('flattenedCompilerDependencies');
        expect(catComponent.flattenedCompilerDependencies).to.have.lengthOf(1);
        const flattenedCompilerDependency = catComponent.flattenedCompilerDependencies[0];
        expect(flattenedCompilerDependency.name).to.equal('webpack/base');
        expect(flattenedCompilerDependency.version).to.equal('0.0.1');
      });
      describe('importing the component to another scope', () => {
        before(() => {
          helper.exportAllComponents();
          helper.reInitLocalScope();
          helper.addRemoteScope();
          helper.addRemoteEnvironment();
          helper.importComponent('bar/foo');
        });
        it('should also import the environment component', () => {
          const output = helper.listLocalScope('--scope');
          expect(output).to.have.string('webpack/base');
        });
        it('should not show the component as modified', () => {
          const output = helper.runCmd('bit status');
          expect(output).to.have.string(statusWorkspaceIsCleanMsg);
        });
        describe('ejecting the environment configuration to component dir', () => {
          before(() => {
            helper.ejectConf('bar/foo');
          });
          it('still should not show the component as modified', () => {
            const output = helper.runCmd('bit status');
            expect(output).to.have.string(statusWorkspaceIsCleanMsg);
          });
        });
        // @todo: needs to be fixed
        describe.skip('ejecting the environment configuration to a directory outside the component dir', () => {
          before(() => {
            helper.ejectConf('bar/foo -p my-conf-dir');
          });
          it('still should not show the component as modified', () => {
            const output = helper.runCmd('bit status');
            expect(output).to.have.string(statusWorkspaceIsCleanMsg);
          });
        });
        // @todo: needs to be fixed
        describe.skip('ejecting the environment configuration to a an inner component dir directory', () => {
          before(() => {
            helper.ejectConf('bar/foo -p {COMPONENT_DIR}/my-inner-dir');
          });
          it('still should not show the component as modified', () => {
            const output = helper.runCmd('bit status');
            expect(output).to.have.string(statusWorkspaceIsCleanMsg);
          });
        });
      });
    });
  });
});
