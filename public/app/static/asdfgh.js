document.addEventListener('DOMContentLoaded', () => {
    // --------------------------------------------------------
    // 1. DOM 엘리먼트 초기화
    // --------------------------------------------------------
    // 페이지 및 네비게이션
    const searchPage = document.getElementById('searchPage');
    const settingsPage = document.getElementById('settingsPage');
    const settingsBtn = document.getElementById('settingsBtn');
    const backBtn = document.getElementById('backBtn');

    // 텍스트 검색창
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const searchResultMessage = document.getElementById('searchResultMessage');
    const imageSearchContainer = document.getElementById('imageSearchContainer');

    // 카메라 관련 엘리먼트
    const cameraPage = document.getElementById('cameraPage');
    const startCameraBtn = document.getElementById('startCameraBtn');
    const closeCameraBtn = document.getElementById('closeCameraBtn');
    const video = document.getElementById('video');
    const photo = document.getElementById('photo');
    const captureBtn = document.getElementById('captureBtn');
    const retryBtn = document.getElementById('retryBtn');
    const canvas = document.getElementById('canvas');

    let cameraStream = null;

    // 숨겨져 있던 이미지 검색 컨테이너 활성화
    imageSearchContainer.style.display = 'block';
    // 카메라 페이지는 초기엔 숨김
    cameraPage.style.display = 'none';

    // --------------------------------------------------------
    // 2. 화면 전환 이벤트 (설정창 ↔ 검색창)
    // --------------------------------------------------------
    settingsBtn.addEventListener('click', () => {
        searchPage.classList.remove('active');
        searchPage.style.display = 'none';
        settingsPage.classList.add('active');
        settingsPage.style.display = 'block';
    });

    backBtn.addEventListener('click', () => {
        settingsPage.classList.remove('active');
        settingsPage.style.display = 'none';
        searchPage.classList.add('active');
        searchPage.style.display = 'block';
    });

    // --------------------------------------------------------
    // 3. 텍스트 도서 검색 기능 (/api/books)
    // --------------------------------------------------------
    searchBtn.addEventListener('click', async () => {
        const query = searchInput.value.trim();
        if (!query) {
            alert('검색어를 입력해주세요.');
            return;
        }

        searchResultMessage.textContent = '검색 중입니다...';

        try {
            // books.py의 router.get("") 엔드포인트 호출
            const response = await fetch(`/api/books?q=${encodeURIComponent(query)}`);
            if (!response.ok) throw new Error('서버 응답 오류');

            const data = await response.json();

            if (data.total_count > 0) {
                searchResultMessage.textContent = `총 ${data.total_count}권의 도서가 검색되었습니다.`;
                // 필요시 이 부분에 검색된 책 목록(data.books)을 UI에 렌더링하는 코드를 추가하세요.
                console.log('검색된 책 목록:', data.books);
            } else {
                searchResultMessage.textContent = '검색 결과가 없습니다.';
            }
        } catch (error) {
            console.error('검색 오류:', error);
            searchResultMessage.textContent = '검색 중 오류가 발생했습니다.';
        }
    });

    // 엔터키로도 검색 가능하게 처리
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchBtn.click();
    });

    // --------------------------------------------------------
    // 4. 카메라 제어 기능
    // --------------------------------------------------------
    async function startCamera() {
        try {
            // 스마트폰의 경우 후면 카메라(environment) 우선 사용
            cameraStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' },
                audio: false
            });
            video.srcObject = cameraStream;

            // UI 상태 변경
            video.style.display = 'block';
            photo.style.display = 'none';
            captureBtn.style.display = 'block';
            retryBtn.style.display = 'none';
            cameraPage.style.display = 'flex';

        } catch (error) {
            console.error('카메라 접근 오류:', error);
            alert('카메라 접근 권한이 필요하거나 기기에서 카메라를 지원하지 않습니다.');
        }
    }

    function stopCamera() {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            cameraStream = null;
        }
        cameraPage.style.display = 'none';
    }

    startCameraBtn.addEventListener('click', startCamera);
    closeCameraBtn.addEventListener('click', stopCamera);

    // 다시 시도 버튼
    retryBtn.addEventListener('click', () => {
        photo.style.display = 'none';
        video.style.display = 'block';
        captureBtn.style.display = 'block';
        retryBtn.style.display = 'none';
    });

    // --------------------------------------------------------
    // 5. 이미지 캡처 및 서버 전송 기능 (/api/scan)
    // --------------------------------------------------------
    captureBtn.addEventListener('click', async () => {
        if (!cameraStream) return;

        // 비디오 크기에 맞춰 캔버스 설정 후 현재 프레임 그리기
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        // 캡처된 화면을 이미지로 변환하여 보여주기
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        photo.src = dataUrl;
        photo.style.display = 'block';
        video.style.display = 'none';

        captureBtn.style.display = 'none';
        retryBtn.style.display = 'block'; // 실패 시 다시 시도할 수 있도록 버튼 표시

        // 카메라 정지 및 메인 화면으로 돌아가기
        stopCamera();
        await uploadScannedImage(dataUrl);
    });

    // 캡처한 이미지를 FastAPI 서버로 전송
    async function uploadScannedImage(dataUrl) {
        searchResultMessage.textContent = '이미지를 분석하는 중입니다...';
        try {
            // Data URL을 Blob(파일) 객체로 변환
            const response = await fetch(dataUrl);
            const blob = await response.blob();

            // multipart/form-data 전송을 위한 FormData 객체 생성
            const formData = new FormData();
            formData.append('-F', blob, 'scan_image.jpg');

            const apiResponse = await fetch('/api/scan', {
                method: 'POST',
                body: formData
            });

            if (!apiResponse.ok) throw new Error(`서버 응답 오류: ${apiResponse.status}`);

            const data = await apiResponse.json();
            console.log('스캔 결과:', data);

            if (data.found && data.book_info) {
                searchResultMessage.textContent = `📖 찾은 도서: ${data.book_info.title} (${data.book_info.author || '저자 미상'})`;
            } else {
                searchResultMessage.textContent = data.message || '이미지에서 도서를 인식하지 못했습니다.';
            }

        } catch (error) {
            console.error('이미지 업로드/분석 오류:', error);
            searchResultMessage.textContent = '스캔 처리 중 오류가 발생했습니다.';
        }
    }
});