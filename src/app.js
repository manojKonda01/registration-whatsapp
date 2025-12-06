import express from "express";
import dotenv from "dotenv";
import routes from "./routes.js";
import bodyParser from "body-parser";
import { connectToMongoDB } from "./services/mongo.service.js"

connectToMongoDB();

dotenv.config();
const app = express();
app.use(bodyParser.json());

app.use("/", routes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});

