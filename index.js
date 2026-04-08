import { writeFileSync } from 'node:fs';

let text = `

## About Me
Hello, I'm Kwon Minjae.  
I am a robotics-oriented developer interested in embedded systems, autonomy, AI, and practical software engineering.

## Profile
- Graduate Student in Computing at Gachon University
- Interested in robotics, autonomous systems, embedded software, and vision-based applications
- Focused on building practical systems through implementation, testing, and iteration

## Education
- Gachon University Graduate School, Department of Artificial Intelligence, IRASC Lab, M.S. Program
  Mar 3, 2026 - Present
- Gachon University, Department of Future Automotive Engineering  
  Feb 2021 - Feb 2026

## Experience
- ROBOTIS, Embedded Team Intern  
  Dec 2025 - Feb 2026
- RoboGates, Hardware Development Intern  
  Mar 2023 - Jul 2025

## Activities
- Executive Member, Take Out Embedded Systems Club  
  Sep 2024 - Jan 2026
- Member, Pay1oad Security Club  
  Sep 2024 - Aug 2025
- Republic of Korea Army, Signaller, 83rd Tank Battalion  
  Apr 4, 2022 - Oct 3, 2023
- President, Robotics Club, Suwon Technical High School  
  Sep 2019 - Aug 2020
- Member, Robotics Club, Suwon Technical High School  
  Mar 2018 - Sep 2019

## Awards
- Champion, 3D Printing Hackathon, 2019 Gyeonggi Science Festival
- Alliance Award, 2019 World Robot Olympiad Korea
- Runner-up, LEGO Autonomous Vehicle Competition, 2019 Pangyo Autonomous Motor Show
- Champion, Intelligent Robot Competition, 2018 Suwon Information & Science Festival

## Certifications
- Computer Literacy Level 2
- Word Processor Level 1
- Electronics Technician
- Information Technology Equipment Technician
- Electronic CAD Technician

## Tech Interests
- Robotics
- Autonomous Driving
- Embedded Systems
- Computer Vision
- AI
- Hardware Design
- Control Systems

## Tools & Stack
- Languages: Python, JavaScript, Java, C/C++, Lua, HTML, CSS
- Platforms & Tools: STM32, Raspberry Pi, Ubuntu, MATLAB, SolidWorks, VS Code, Arduino, OpenCV, ROS/ROS2
- Hardware: 3D Printers, OHT, Robot Arms, AMR, AGV

## Latest Blog Posts

`;

(async () => {
  const response = await fetch('https://stanase.com/latest-posts.json', {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (compatible; GitHubActions/1.0; +https://github.com/7ihin/7ihin)'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch latest posts: ${response.status}`);
  }

  const items = await response.json();

  for (const [index, item] of items.slice(0, 5).entries()) {
    const title = item.title || 'Untitled';
    const link = item.url || 'https://stanase.com';

    console.log(`${index + 1}번째 게시물`);
    console.log(`추가될 제목: ${title}`);
    console.log(`추가될 링크: ${link}`);

    text += `<a href="${link}">${title}</a></br>`;
  }

  writeFileSync('README.md', text, 'utf8');
  console.log('업데이트 완료');
})();
