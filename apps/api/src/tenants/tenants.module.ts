import { Module } from "@nestjs/common";
import { DbModule } from "../db/db.module";
import { QuotasModule } from "../quotas/quotas.module";
import { TenantsService } from "./tenants.service";
import { TenantsController } from "./tenants.controller";

@Module({
    imports: [DbModule, QuotasModule],
    providers: [TenantsService],
    exports: [TenantsService],
    controllers: [TenantsController]
})

export class TenantsModule { }