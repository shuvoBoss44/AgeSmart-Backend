require("dotenv").config();
const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const PDFDocument = require("pdfkit");
const { Buffer } = require("buffer");

const app = express();

// Configure multer for file uploads with 2MB limit
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        } else {
            cb(new Error("Only JPEG/PNG images are allowed!"));
        }
    },
}).fields([
    { name: "idFileFront", maxCount: 1 },
    { name: "idFileBack", maxCount: 1 },
    { name: "selfie1", maxCount: 1 },
    { name: "selfie2", maxCount: 1 },
    { name: "selfie3", maxCount: 1 },
]);

app.use(express.json());
app.use(cors({
    origin: process.env.FrontendUrl || "https://age-smart.netlify.app",
    methods: ["GET", "POST", "PATCH", "DELETE"],
    credentials: true,
}));
app.use(express.urlencoded({ extended: true }));

app.post("/send-email", (req, res) => {
    upload(req, res, async (err) => {
        if (err) {
            console.error("File upload error:", err.message);
            return res.status(400).send(err.message);
        }

        try {
            const { firstName, lastName, applyingPosition, email, dateOfBirth, phoneNumber, mobileNumber, addressLine1, city, zipCode, country } = req.body;
            const files = req.files;

            // Validate required fields
            if (!firstName || !lastName || !applyingPosition || !email || !dateOfBirth || !phoneNumber || !files.idFileFront || !files.idFileBack || !files.selfie1 || !files.selfie2 || !files.selfie3) {
                return res.status(400).send("All required fields and files must be provided.");
            }

            // Generate PDF
            const doc = new PDFDocument({ size: "A4", margin: 40 });
            let buffers = [];
            doc.on("data", buffers.push.bind(buffers));
            doc.on("end", async () => {
                const pdfBuffer = Buffer.concat(buffers);

                // Configure Nodemailer transporter
                const transporter = nodemailer.createTransport({
                    host: process.env.SMTP_HOST,
                    port: process.env.SMTP_PORT,
                    secure: process.env.SMTP_SECURE === "true",
                    auth: {
                        user: process.env.SMTP_USER,
                        pass: process.env.SMTP_PASS,
                    },
                });

                // HTML email template
                const htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; color: #333; line-height: 1.6; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; border-radius: 8px; }
              h1 { color: #4a4a8c; text-align: center; }
              .section { margin-bottom: 20px; }
              .section h2 { color: #4a4a8c; border-bottom: 2px solid #4a4a8c; padding-bottom: 5px; }
              .field { margin: 10px 0; }
              .field-label { font-weight: bold; }
              .footer { text-align: center; margin-top: 20px; color: #777; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Job Application Submission</h1>
              <div class="section">
                <h2>Applicant Details</h2>
                <div class="field"><span class="field-label">First Name:</span> ${firstName}</div>
                <div class="field"><span class="field-label">Last Name:</span> ${lastName}</div>
                <div class="field"><span class="field-label">Applying Position:</span> ${applyingPosition}</div>
                <div class="field"><span class="field-label">Email:</span> ${email}</div>
                <div class="field"><span class="field-label">Date of Birth:</span> ${dateOfBirth}</div>
                <div class="field"><span class="field-label">Phone Number:</span> ${phoneNumber}</div>
                <div class="field"><span class="field-label">Mobile Number:</span> ${mobileNumber || "Not provided"}</div>
                <div class="field"><span class="field-label">Address Line 1:</span> ${addressLine1 || "Not provided"}</div>
                <div class="field"><span class="field-label">City:</span> ${city || "Not provided"}</div>
                <div class="field"><span class="field-label">Zip Code:</span> ${zipCode || "Not provided"}</div>
                <div class="field"><span class="field-label">Country:</span> ${country || "Not provided"}</div>
              </div>
              <div class="footer">
                <p>Thank You</p>
              </div>
            </div>
          </body>
          </html>
        `;

                // Prepare mail options
                const mailOptions = {
                    from: process.env.SMTP_USER,
                    to: email,
                    subject: `Job Application from ${firstName} ${lastName}`,
                    html: htmlContent,
                    attachments: [
                        { filename: files.idFileFront[0].originalname, content: files.idFileFront[0].buffer },
                        { filename: files.idFileBack[0].originalname, content: files.idFileBack[0].buffer },
                        { filename: files.selfie1[0].originalname, content: files.selfie1[0].buffer },
                        { filename: files.selfie2[0].originalname, content: files.selfie2[0].buffer },
                        { filename: files.selfie3[0].originalname, content: files.selfie3[0].buffer },
                        { filename: `Application_${firstName}_${lastName}.pdf`, content: pdfBuffer },
                    ],
                };

                // Send email
                await transporter.sendMail(mailOptions);
                res.status(200).send("Email and PDF sent successfully");
            });

            // Add content to PDF
            doc.font("Helvetica-Bold").fontSize(20).text("Job Application", { align: "center" });
            doc.moveDown(0.5);
            doc.font("Helvetica").fontSize(10).text(`Generated on ${new Date().toLocaleDateString()}`, { align: "center" });
            doc.moveDown(1);

            // Applicant Details Table
            doc.font("Helvetica-Bold").fontSize(14).text("Applicant Details", { underline: true });
            doc.moveDown(0.5);

            const tableTop = doc.y;
            const col1X = 40;
            const col2X = 180;
            const rowHeight = 20;
            const tableWidth = 515;
            const tableHeight = 220;

            doc.rect(col1X, tableTop, tableWidth, tableHeight).stroke();
            doc.moveTo(col2X - 10, tableTop).lineTo(col2X - 10, tableTop + tableHeight).stroke();

            const details = [
                { label: "First Name", value: firstName },
                { label: "Last Name", value: lastName },
                { label: "Applying Position", value: applyingPosition },
                { label: "Email", value: email },
                { label: "Date of Birth", value: dateOfBirth },
                { label: "Phone Number", value: phoneNumber },
                { label: "Mobile Number", value: mobileNumber || "Not provided" },
                { label: "Address Line 1", value: addressLine1 || "Not provided" },
                { label: "City", value: city || "Not provided" },
                { label: "Zip Code", value: zipCode || "Not provided" },
                { label: "Country", value: country || "Not provided" },
            ];

            let currentY = tableTop;
            details.forEach((item, index) => {
                if (index > 0) {
                    doc.moveTo(col1X, currentY).lineTo(col1X + tableWidth, currentY).stroke();
                }
                doc.font("Helvetica-Bold").fontSize(10).text(item.label, col1X + 5, currentY + 5, { width: 130, align: "left" });
                doc.font("Helvetica").fontSize(10).text(item.value, col2X + 5, currentY + 5, { width: 330, align: "left" });
                currentY += rowHeight;
            });

            doc.moveDown(2);
            doc.font("Helvetica-Bold").fontSize(14).text("Uploaded Images", { underline: true });
            doc.moveDown(0.5);

            const images = [
                { data: files.idFileFront[0].buffer, title: "NID Card (Front)" },
                { data: files.idFileBack[0].buffer, title: "NID Card (Back)" },
                { data: files.selfie1[0].buffer, title: "Selfie 1" },
                { data: files.selfie2[0].buffer, title: "Selfie 2" },
                { data: files.selfie3[0].buffer, title: "Selfie 3" },
            ];

            const imageWidth = 160;
            const imageHeight = 100;
            const gap = 15;
            let imageX = col1X;
            let imageY = doc.y;

            images.slice(0, 2).forEach((image) => {
                doc.image(image.data, imageX, imageY, { fit: [imageWidth, imageHeight], align: "center" });
                doc.font("Helvetica").fontSize(8).text(image.title, imageX, imageY + imageHeight + 5, { align: "center", width: imageWidth });
                imageX += imageWidth + gap;
            });

            imageX = col1X;
            imageY += imageHeight + 25;
            images.slice(2).forEach((image) => {
                doc.image(image.data, imageX, imageY, { fit: [imageWidth, imageHeight], align: "center" });
                doc.font("Helvetica").fontSize(8).text(image.title, imageX, imageY + imageHeight + 5, { align: "center", width: imageWidth });
                imageX += imageWidth + gap;
            });

            doc.moveDown(2);
            doc.font("Helvetica").fontSize(8).fillColor("#777").text("AgeeSmart - Job Application", { align: "center" });

            doc.end();
        } catch (error) {
            console.error("Error processing request:", error);
            res.status(500).send("Error processing request");
        }
    });
});

app.listen(process.env.PORT, () => {
    console.log(`Server is running at port ${process.env.PORT}`);
});