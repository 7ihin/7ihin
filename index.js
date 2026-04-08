import { writeFileSync } from 'node:fs';
import Parser from 'rss-parser';

/**
 * README.MD에 작성될 페이지 텍스트
 * @type {string}
 */
let text = `

## About Me
Hello, I'm Kwon Minjae.
I'm a developer passionate about robotics, AI, and software engineering.

## Introduce
 * I enjoy hardware design and assembly.
 * I like thinking through the structure of code.
 * I enjoy troubleshooting.

## School
 * Suwon Technical High School, Department of Electronics and Communication (Feb 2018 - Aug 2020)
 * Gachon University Department of Future Automotive Engineering (Feb 2021 - Present)

## Company
 * RoboGates, Hardware Development Intern (Mar 2023 - Jul 2025)

## Activity
 * Champion - Intelligent Robot Competition 2018 Suwon Information & Science Festival (Oct 20)
 * Runner-up - LEGO Autonomous Vehicle Competition - 2019 Pangyo Autonomous Motor Show
 * Alliance Award - 2019 World Robot Olympiad Korea (Aug 11)
 * Champion of 3D Printing Hackathon - 2019 Gyeonggi Science Festival (Oct 19)
 * Member, Robotics Club, Suwon Technical High School (Mar 2018 - Sep 2019)
 * President, Robotics Club, Suwon Technical High School (Sep 2019 - Aug 2020)
 * Republic of Korea Army, Signaller, 83rd Tank Battalion (Apr 4, 2022 - Oct 3, 2023)
 * Member, Pay1oad Security Club (Sep 2024 - Jul 2025)
 * Executive Member, Take Out Embedded Systems Club (Sep 2024 - Present)
 * Executive Member, Baekjoon In Gacheon Algorithm Club (Sep 2024 - Present)

## Certifications
 * Computer Literacy Level 2
 * Word Processor Level 1
 * Electronics Technician
 * Information Technology Equipment Technician
 * Electronic CAD Technician

## Interest
 * Programming Languages
   * Python
   * JavaScript
   * Java
   * C/C++
   * Lua
   * HTML
   * CSS

 * Software/Tools
   * Robot Control
   * Hardware Design
   * STM32
   * Raspberry Pi
   * Ubuntu
   * MATLAB
   * SolidWorks
   * VS Code
   * Arduino
   * OpenCV
   * ROS/ROS2

 * Hardware/Tools
   * 3D Printers (Bambu Lab A1 Mini)
   * Overhead Hoist Transport (OHT)
   * Articulated Robot / Robot Arm
   * AMR (Autonomous Mobile Robot) / AGV (Automated Guided Vehicle)

## Latest Blog Posts

`;

const parser = new Parser({
  headers: {
    Accept: 'application/rss+xml, application/xml, text/xml; q=0.1',
  },
});

(async () => {
  const feed = await parser.parseURL('https://www.stanase.com/rss.xml');
  const items = (feed.items || []).slice(0, 5);

  for (const [index, item] of items.entries()) {
    const title = item.title || 'Untitled';
    const link = item.link || 'https://stanase.com';

    console.log(`${index + 1}번째 게시물`);
    console.log(`추가될 제목: ${title}`);
    console.log(`추가될 링크: ${link}`);

    text += `<a href="${link}">${title}</a></br>`;
  }

  writeFileSync('README.md', text, 'utf8');
  console.log('업데이트 완료');
})();
