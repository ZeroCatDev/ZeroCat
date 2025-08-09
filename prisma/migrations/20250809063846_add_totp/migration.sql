-- AlterTable
ALTER TABLE `ow_users_contacts` MODIFY `contact_type` ENUM('email', 'phone', 'qq', 'other', 'oauth_google', 'oauth_github', 'oauth_microsoft', 'oauth_40code', 'oauth_linuxdo', 'totp', 'passkey') NOT NULL;
