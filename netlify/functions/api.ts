import serverless from "serverless-http";

import { createServer } from "../../server";
import { validateProductionEnvironment } from "../../server/env";

validateProductionEnvironment();

export const handler = serverless(createServer());
