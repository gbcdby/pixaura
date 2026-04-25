import { Module, Global } from "@nestjs/common";
import { OssService } from "./oss.service";
import { UrlTransformService } from "../services/url-transform.service";
import { NgrokService } from "../services/ngrok.service";
import { TempFileService } from "../services/temp-file.service";

@Global()
@Module({
  providers: [OssService, UrlTransformService, NgrokService, TempFileService],
  exports: [OssService, UrlTransformService, NgrokService, TempFileService],
})
export class OssModule {}
