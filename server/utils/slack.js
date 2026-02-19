const axios = require('axios');
const { App } = require('@slack/bolt');

let slackApp = null;
let isSocketModeConnected = false;

function initSlackSocketMode() {
  const appToken = process.env.SLACK_APP_TOKEN;
  
  if (!appToken) {
    console.warn('Slack Socket Mode not configured (SLACK_APP_TOKEN not set)');
    return;
  }
  
  try {
    slackApp = new App({
      appToken: appToken,
      socketMode: true,
      token: process.env.SLACK_BOT_TOKEN // Optional bot token for additional features
    });
    
    // Handle approve button
    slackApp.action(/approve_/, async ({ ack, body, say }) => {
      await ack();
      
      const prequeueId = body.actions[0].action_id.replace('approve_', '');
      const userId = body.user.id;
      
      try {
        await handleApprove(prequeueId, userId, body.response_url);
      } catch (error) {
        console.error('Error handling approve:', error);
      }
    });
    
    // Handle decline button
    slackApp.action(/decline_/, async ({ ack, body, say }) => {
      await ack();
      
      const prequeueId = body.actions[0].action_id.replace('decline_', '');
      const userId = body.user.id;
      
      try {
        await handleDecline(prequeueId, userId, body.response_url);
      } catch (error) {
        console.error('Error handling decline:', error);
      }
    });
    
    slackApp.start();
    console.log('Slack Socket Mode initialized');
    isSocketModeConnected = true;
  } catch (error) {
    console.error('Error initializing Slack Socket Mode:', error.message);
  }
}

async function handleApprove(prequeueId, userId, responseUrl) {
  try {
    const { getDb } = require('../db');
    const db = getDb();
    const prequeue = db.prepare('SELECT * FROM prequeue WHERE id = ?').get(prequeueId);
    
    if (!prequeue) {
      await axios.post(responseUrl, {
        text: 'Error: Prequeue entry not found'
      });
      return;
    }
    
    if (prequeue.status !== 'pending') {
      await axios.post(responseUrl, {
        text: `Error: Track already ${prequeue.status}`
      });
      return;
    }
    
    // Get track info and add to queue
    const { getTrack, addToQueue } = require('./spotify');
    const trackInfo = await getTrack(prequeue.track_id);
    await addToQueue(trackInfo.uri);
    
    // Update prequeue status with approver
    db.prepare('UPDATE prequeue SET status = ?, approved_by = ? WHERE id = ?').run('approved', userId, prequeueId);

    // Log queue attempt
    const now = Math.floor(Date.now() / 1000);
    db.prepare(`
      INSERT INTO queue_attempts (fingerprint_id, track_id, track_name, artist_name, status, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(prequeue.fingerprint_id, prequeue.track_id, prequeue.track_name, prequeue.artist_name, 'success', now);

    // Send response
    await axios.post(responseUrl, {
      text: `✅ Approved by <@${userId}>: ${prequeue.track_name} by ${prequeue.artist_name}`,
      replace_original: true
    });
    
    console.log(`Approved track: ${prequeue.track_name} by user ${userId}`);
  } catch (error) {
    console.error('Error approving track:', error);
    try {
      await axios.post(responseUrl, {
        text: `Error approving track: ${error.message}`,
        replace_original: true
      });
    } catch (e) {
      console.error('Error sending response:', e);
    }
  }
}

async function handleDecline(prequeueId, userId, responseUrl) {
  try {
    const { getDb } = require('../db');
    const db = getDb();
    const prequeue = db.prepare('SELECT * FROM prequeue WHERE id = ?').get(prequeueId);
    
    if (!prequeue) {
      await axios.post(responseUrl, {
        text: 'Error: Prequeue entry not found'
      });
      return;
    }
    
    if (prequeue.status !== 'pending') {
      await axios.post(responseUrl, {
        text: `Error: Track already ${prequeue.status}`
      });
      return;
    }
    
    // Update prequeue status with decliner
    db.prepare('UPDATE prequeue SET status = ?, approved_by = ? WHERE id = ?').run('declined', userId, prequeueId);

    // Send response
    await axios.post(responseUrl, {
      text: `❌ Declined by <@${userId}>: ${prequeue.track_name} by ${prequeue.artist_name}`,
      replace_original: true
    });
    
    console.log(`Declined track: ${prequeue.track_name} by user ${userId}`);
  } catch (error) {
    console.error('Error declining track:', error);
    try {
      await axios.post(responseUrl, {
        text: `Error declining track: ${error.message}`,
        replace_original: true
      });
    } catch (e) {
      console.error('Error sending response:', e);
    }
  }
}

async function sendPrequeueMessage(trackInfo, prequeueId) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  
  if (!webhookUrl) {
    console.warn('Slack webhook URL not configured');
    return false;
  }
  
  try {
    const message = {
      text: `New song queued for approval`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*<!subteam^S0AFQAYTM2Q|cf-toronto-song-reviwers> New Song Request*\n*${trackInfo.name}*\nby ${trackInfo.artists}`
          },
          accessory: {
            type: 'image',
            image_url: trackInfo.album_art || 'https://via.placeholder.com/200',
            alt_text: trackInfo.album
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Album*\n${trackInfo.album}`
            },
            {
              type: 'mrkdwn',
              text: `*Duration*\n${Math.floor(trackInfo.duration_ms / 60000)}:${String(Math.floor((trackInfo.duration_ms % 60000) / 1000)).padStart(2, '0')}`
            }
          ]
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'Approve',
                emoji: true
              },
              value: prequeueId,
              action_id: `approve_${prequeueId}`,
              style: 'primary'
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'Decline',
                emoji: true
              },
              value: prequeueId,
              action_id: `decline_${prequeueId}`,
              style: 'danger'
            }
          ]
        }
      ]
    };
    
    console.log('Sending Slack message:', JSON.stringify(message, null, 2));
    const response = await axios.post(webhookUrl, message);
    console.log('Slack response:', response.status, response.data);
    return true;
  } catch (error) {
    console.error('Error sending Slack message:', error.response?.data || error.message);
    return false;
  }
}

module.exports = {
  sendPrequeueMessage,
  initSlackSocketMode
};
