const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema(
  {
    company: { type: String, required: true },
    role: { type: String, required: true },
    platform: { type: String, required: true },
    url: { type: String },
     contactEmails: { type: [String], default: [] },
   jobDescription: { type: String, default: '' },
   coverLetterText: { type: String, default: '' },
   coverLetterPDFLink: { type: String, default: '' },
    status: {
      type: String,
      enum: [
        'saved',
        'applied',
        'processing',
        'interview',
        'offer',
        'rejected',
        'no_response',
        'interview_scheduled',
        'technical_interview',
        'offer_letter_received',
        'follow_up_sent',
        'withdrawn',
      ],
      default: 'applied',
    },
    appliedDate: { type: Date, default: Date.now },
    lastContactDate: { type: Date },
    followUpCount: { type: Number, default: 0 },
    notes: { type: String },
    tags: [String],
    sourceEmailId: { type: String },
    cvTailoredLink: { type: String },
    jdSnapshot: {
      description: String,
      skillsRequired: [String],
      interviewTopics: [String],
      suggestedQuestions: [String],
    }, deleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    binExpiresAt: { type: Date },


    emailLog: [
      {
        direction: { type: String, enum: ['inbound', 'outbound'] },
        subject: String,
        from: String,        // sender email
        to: String,          // recipient email
        gmailMessageId: String,
        gmailThreadId: String,
        snippet: String,
        sentAt: Date,
        link: String,        // constructed link, e.g., https://mail.google.com/mail/u/0/#all/<id>
      }
    ]
  },
  { timestamps: true }
);

module.exports = mongoose.model('Job', jobSchema);