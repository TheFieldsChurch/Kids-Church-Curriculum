# The Fields Church Kids Church Sign-In

Open the deployed link in Safari on an iPhone or iPad, or in a browser on a laptop. The app is designed for leaders to operate. Each sign-in and sign-out is saved straight to Google Sheets. The app shows the current Sydney date, while the attendance tab keeps previous dates.

## Connect the app to Google Sheets

1. Open the church’s private attendance spreadsheet as its owner. You can also start with a blank private spreadsheet. If you already have a working desktop script, leave it intact and create a separate project at [Google Apps Script](https://script.google.com/).
2. In the Apps Script project, paste the contents of [Code.gs](Code.gs) into the script editor. Add an HTML file named **Index** and paste in [Index.html](Index.html). Save the project.
3. In **Project Settings → Script properties**, add `ATTENDANCE_SPREADSHEET_ID`. Set its value to the part of the Google Sheets URL between `/d/` and `/edit`. In Google Sheets, set the spreadsheet’s time zone to **Sydney** under **File → Settings** so the times shown on the sheet agree with the app.
4. In Apps Script select **Deploy → New deployment → Web app**. Use **User accessing the web app** for **Execute as**. Choose **Only myself** for one leader, the church’s Workspace domain where available, or **Anyone with Google account** for leaders on separate Google accounts. Keep Google Sheets **General access** set to **Restricted**. Give each leader who should record attendance individual **Editor** access to the sheet. The deployment runs as each leader, and their access to the sheet controls whether they can view and save attendance.
5. Open the deployed **Web app URL** while signed in to an authorised account and approve Google’s permissions. On first use, the app creates **Kids Church Register** and **Kids Church Attendance**. It uses those exact tab names. If either already exists with different headings, use a separate sheet for the first test.
6. On the iPhone or iPad, open the same web app URL in Safari under the same authorised Google account. Sign in a test child, open **Refresh Attendance** from another device, and sign the child out. Verify that the sheet contains a single attendance row with both times. Delete the test row from both tabs when finished.

## Existing records

Existing tabs and attendance history stay in the spreadsheet. The app uses its two named tabs. Existing children will appear in the app after their register is mapped into the new register tab. To import, keep each child's existing unique ID where available and match the new tab headings. Store dates of birth as `YYYY-MM-DD` and phone numbers as plain text so Google Sheets retains leading zeroes. For historical attendance imports, preserve the corresponding child IDs and store service dates as plain-text `YYYY-MM-DD`. Test any migration on a copy first.

## At the door

- Search by name and tap a child to sign them in. Tap **New Child** for a first visit.
- Tap **Sign Out** when the child leaves. Each child has one attendance row per Sydney calendar date, matching the original one-visit-per-day workflow.
- The screen refreshes periodically and when the browser regains focus. Use **Refresh Attendance** for an immediate update.
- Tap **Label** or **Print Name Tags** to print. Mobile sign-in is independent of printing. Check that Safari can see the church printer and that it accepts the label size before relying on mobile printing.
- The form confirms each save in Google Sheets and shows a message if the save fails. The app requires an internet connection.
