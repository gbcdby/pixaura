/**
 * CLI 命令入口
 * 用于执行各种管理命令脚本
 */

import { CommandFactory } from 'nest-commander';
import { CliModule } from './cli.module';

async function bootstrap() {
  await CommandFactory.run(CliModule, {
    logger: ['error', 'warn', 'log'],
    usePlugins: true,
    cliName: 'pixaura-cli',
  });
}

bootstrap();